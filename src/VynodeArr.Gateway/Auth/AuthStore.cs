using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace VynodeArr.Gateway.Auth;

public sealed class AuthStore(string databasePath)
{
    private readonly string _connectionString = new SqliteConnectionStringBuilder
    {
        DataSource = databasePath,
        Mode = SqliteOpenMode.ReadWriteCreate,
        Cache = SqliteCacheMode.Shared,
        Pooling = false
    }.ToString();
    private readonly SemaphoreSlim _setupLock = new(1, 1);

    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(databasePath)!);
        await using var connection = await OpenAsync(cancellationToken);
        await ExecuteAsync(connection, "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;", cancellationToken);
        await ExecuteAsync(connection, """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL COLLATE NOCASE UNIQUE,
                email TEXT COLLATE NOCASE UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                last_login_at TEXT
            );
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                secret_hash BLOB NOT NULL,
                created_at TEXT NOT NULL,
                last_seen_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                absolute_expires_at TEXT NOT NULL,
                revoked_at TEXT,
                user_agent TEXT,
                client_address TEXT
            );
            CREATE INDEX IF NOT EXISTS ix_sessions_expiry ON sessions(expires_at);
            CREATE TABLE IF NOT EXISTS login_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                identifier_hash TEXT NOT NULL,
                client_address TEXT NOT NULL,
                succeeded INTEGER NOT NULL,
                occurred_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS ix_login_attempts_lookup ON login_attempts(identifier_hash, client_address, occurred_at);
            CREATE TABLE IF NOT EXISTS audit_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                occurred_at TEXT NOT NULL,
                user_id INTEGER,
                username TEXT,
                action TEXT NOT NULL,
                target_type TEXT,
                target_id TEXT,
                request_id TEXT,
                result TEXT NOT NULL,
                metadata_json TEXT,
                client_address TEXT
            );
            """, cancellationToken);
    }

    public async Task<bool> HasUsersAsync(CancellationToken cancellationToken = default)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT EXISTS(SELECT 1 FROM users WHERE enabled = 1);";
        return Convert.ToInt64(await command.ExecuteScalarAsync(cancellationToken)) == 1;
    }

    public async Task<AuthUser?> CreateFirstAdministratorAsync(string username, string? email, string passwordHash, CancellationToken cancellationToken)
    {
        await _setupLock.WaitAsync(cancellationToken);
        try
        {
            await using var connection = await OpenAsync(cancellationToken);
            await using var transaction = (SqliteTransaction)await connection.BeginTransactionAsync(cancellationToken);
            await using var count = connection.CreateCommand();
            count.Transaction = transaction;
            count.CommandText = "SELECT COUNT(*) FROM users;";
            if (Convert.ToInt64(await count.ExecuteScalarAsync(cancellationToken)) != 0) return null;

            var now = DateTimeOffset.UtcNow.ToString("O");
            await using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = """
                INSERT INTO users(username,email,password_hash,role,enabled,created_at,updated_at)
                VALUES($username,$email,$hash,$role,1,$now,$now);
                SELECT last_insert_rowid();
                """;
            command.Parameters.AddWithValue("$username", username);
            command.Parameters.AddWithValue("$email", string.IsNullOrWhiteSpace(email) ? DBNull.Value : email.Trim());
            command.Parameters.AddWithValue("$hash", passwordHash);
            command.Parameters.AddWithValue("$role", VynodeArrRoles.Administrator);
            command.Parameters.AddWithValue("$now", now);
            var id = Convert.ToInt64(await command.ExecuteScalarAsync(cancellationToken));
            await transaction.CommitAsync(cancellationToken);
            return new AuthUser(id, username, email, passwordHash, VynodeArrRoles.Administrator, true);
        }
        finally { _setupLock.Release(); }
    }

    public async Task<AuthUser?> FindUserAsync(string identifier, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT id,username,email,password_hash,role,enabled FROM users WHERE username=$id OR email=$id LIMIT 1;";
        command.Parameters.AddWithValue("$id", identifier.Trim());
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? ReadUser(reader) : null;
    }

    public async Task<SessionToken> CreateSessionAsync(AuthUser user, string? userAgent, string clientAddress, CancellationToken cancellationToken)
    {
        var secret = Base64Url(RandomNumberGenerator.GetBytes(32));
        var now = DateTimeOffset.UtcNow;
        var expires = now.AddHours(12);
        await using var connection = await OpenAsync(cancellationToken);
        await using var transaction = (SqliteTransaction)await connection.BeginTransactionAsync(cancellationToken);
        await using var revoke = connection.CreateCommand();
        revoke.Transaction = transaction;
        revoke.CommandText = "UPDATE sessions SET revoked_at=$now WHERE user_id=$user AND revoked_at IS NULL;";
        revoke.Parameters.AddWithValue("$now", now.ToString("O"));
        revoke.Parameters.AddWithValue("$user", user.Id);
        await revoke.ExecuteNonQueryAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            INSERT INTO sessions(user_id,secret_hash,created_at,last_seen_at,expires_at,absolute_expires_at,user_agent,client_address)
            VALUES($user,$hash,$now,$now,$expires,$absolute,$agent,$address);
            SELECT last_insert_rowid();
            """;
        command.Parameters.AddWithValue("$user", user.Id);
        command.Parameters.AddWithValue("$hash", SHA256.HashData(Encoding.UTF8.GetBytes(secret)));
        command.Parameters.AddWithValue("$now", now.ToString("O"));
        command.Parameters.AddWithValue("$expires", expires.ToString("O"));
        command.Parameters.AddWithValue("$absolute", now.AddDays(7).ToString("O"));
        command.Parameters.AddWithValue("$agent", (object?)Truncate(userAgent, 300) ?? DBNull.Value);
        command.Parameters.AddWithValue("$address", clientAddress);
        var id = Convert.ToInt64(await command.ExecuteScalarAsync(cancellationToken));
        await transaction.CommitAsync(cancellationToken);
        return new SessionToken(id, secret, expires);
    }

    public async Task<AuthenticatedSession?> ValidateSessionAsync(string token, CancellationToken cancellationToken)
    {
        if (!TryParseToken(token, out var id, out var secret)) return null;
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT s.id,s.secret_hash,s.expires_at,s.absolute_expires_at,s.last_seen_at,
                   u.id,u.username,u.email,u.password_hash,u.role,u.enabled
            FROM sessions s JOIN users u ON u.id=s.user_id
            WHERE s.id=$id AND s.revoked_at IS NULL LIMIT 1;
            """;
        command.Parameters.AddWithValue("$id", id);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken)) return null;
        var expected = (byte[])reader[1];
        var actual = SHA256.HashData(Encoding.UTF8.GetBytes(secret));
        var now = DateTimeOffset.UtcNow;
        if (!CryptographicOperations.FixedTimeEquals(expected, actual) ||
            DateTimeOffset.Parse(reader.GetString(2)) <= now || DateTimeOffset.Parse(reader.GetString(3)) <= now || !reader.GetBoolean(10)) return null;
        var lastSeen = DateTimeOffset.Parse(reader.GetString(4));
        var user = new AuthUser(reader.GetInt64(5), reader.GetString(6), reader.IsDBNull(7) ? null : reader.GetString(7), reader.GetString(8), reader.GetString(9), reader.GetBoolean(10));
        await reader.DisposeAsync();
        if (now - lastSeen > TimeSpan.FromMinutes(5))
        {
            await using var touch = connection.CreateCommand();
            touch.CommandText = "UPDATE sessions SET last_seen_at=$now,expires_at=$expires WHERE id=$id;";
            touch.Parameters.AddWithValue("$now", now.ToString("O"));
            touch.Parameters.AddWithValue("$expires", now.AddHours(12).ToString("O"));
            touch.Parameters.AddWithValue("$id", id);
            await touch.ExecuteNonQueryAsync(cancellationToken);
        }
        return new AuthenticatedSession(id, user);
    }

    public async Task RevokeSessionAsync(long sessionId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = "UPDATE sessions SET revoked_at=$now WHERE id=$id AND revoked_at IS NULL;";
        command.Parameters.AddWithValue("$now", DateTimeOffset.UtcNow.ToString("O"));
        command.Parameters.AddWithValue("$id", sessionId);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<int> RecentFailuresAsync(string identifier, string address, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT COUNT(*) FROM login_attempts WHERE identifier_hash=$id AND client_address=$address AND succeeded=0 AND occurred_at >= $since;";
        command.Parameters.AddWithValue("$id", IdentifierHash(identifier));
        command.Parameters.AddWithValue("$address", address);
        command.Parameters.AddWithValue("$since", DateTimeOffset.UtcNow.AddMinutes(-15).ToString("O"));
        return Convert.ToInt32(await command.ExecuteScalarAsync(cancellationToken));
    }

    public async Task RecordLoginAsync(string identifier, string address, bool succeeded, CancellationToken cancellationToken)
    {
        await using var connection = await OpenAsync(cancellationToken);
        if (succeeded)
        {
            await using var clear = connection.CreateCommand();
            clear.CommandText = "DELETE FROM login_attempts WHERE identifier_hash=$id AND client_address=$address;";
            clear.Parameters.AddWithValue("$id", IdentifierHash(identifier)); clear.Parameters.AddWithValue("$address", address);
            await clear.ExecuteNonQueryAsync(cancellationToken);
        }
        await using var command = connection.CreateCommand();
        command.CommandText = "INSERT INTO login_attempts(identifier_hash,client_address,succeeded,occurred_at) VALUES($id,$address,$ok,$now);";
        command.Parameters.AddWithValue("$id", IdentifierHash(identifier)); command.Parameters.AddWithValue("$address", address);
        command.Parameters.AddWithValue("$ok", succeeded); command.Parameters.AddWithValue("$now", DateTimeOffset.UtcNow.ToString("O"));
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task AuditAsync(HttpContext context, string action, string result, string? targetType = null, string? targetId = null, object? metadata = null)
    {
        await using var connection = await OpenAsync(context.RequestAborted);
        await using var command = connection.CreateCommand();
        command.CommandText = "INSERT INTO audit_events(occurred_at,user_id,username,action,target_type,target_id,request_id,result,metadata_json,client_address) VALUES($at,$uid,$user,$action,$type,$target,$request,$result,$meta,$address);";
        command.Parameters.AddWithValue("$at", DateTimeOffset.UtcNow.ToString("O"));
        command.Parameters.AddWithValue("$uid", long.TryParse(context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var userId) ? userId : DBNull.Value);
        command.Parameters.AddWithValue("$user", (object?)context.User.Identity?.Name ?? DBNull.Value);
        command.Parameters.AddWithValue("$action", action); command.Parameters.AddWithValue("$type", (object?)targetType ?? DBNull.Value);
        command.Parameters.AddWithValue("$target", (object?)targetId ?? DBNull.Value); command.Parameters.AddWithValue("$request", context.TraceIdentifier);
        command.Parameters.AddWithValue("$result", result); command.Parameters.AddWithValue("$meta", metadata is null ? DBNull.Value : JsonSerializer.Serialize(metadata));
        command.Parameters.AddWithValue("$address", ClientAddress(context));
        await command.ExecuteNonQueryAsync(context.RequestAborted);
    }

    public static string ClientAddress(HttpContext context) => context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    private async Task<SqliteConnection> OpenAsync(CancellationToken cancellationToken)
    {
        var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        return connection;
    }
    private static async Task ExecuteAsync(SqliteConnection connection, string sql, CancellationToken ct) { await using var command = connection.CreateCommand(); command.CommandText = sql; await command.ExecuteNonQueryAsync(ct); }
    private static AuthUser ReadUser(SqliteDataReader r) => new(r.GetInt64(0), r.GetString(1), r.IsDBNull(2) ? null : r.GetString(2), r.GetString(3), r.GetString(4), r.GetBoolean(5));
    private static bool TryParseToken(string token, out long id, out string secret) { id = 0; secret = ""; if (!token.StartsWith("ses_", StringComparison.Ordinal)) return false; var parts = token[4..].Split('.', 2); return parts.Length == 2 && long.TryParse(parts[0], out id) && (secret = parts[1]).Length >= 32; }
    private static string IdentifierHash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value.Trim().ToLowerInvariant())));
    private static string Base64Url(byte[] value) => Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    private static string? Truncate(string? value, int length) => value is null || value.Length <= length ? value : value[..length];
}
