using System.Net;

namespace VynodeArr.Gateway.Auth;

public static class AuthPages
{
    public static string Login(string csrf, string? returnUrl, bool setupRequired, string? error = null) => Page(
        "Sign in",
        setupRequired
            ? "<h1>Setup required</h1><p>Create the first administrator before signing in.</p><a class=\"button\" href=\"/setup\">Set up VynodeArr</a>"
            : $$"""
               <h1>Sign in</h1><p>Use your VynodeArr account.</p>
               {{Error(error)}}
               <form method="post" action="/api/auth/login">
                 <input type="hidden" name="__RequestVerificationToken" value="{{E(csrf)}}">
                 <input type="hidden" name="returnUrl" value="{{E(returnUrl)}}">
                 <label>Username or email<input name="identifier" autocomplete="username" required autofocus></label>
                 <label>Password<span class="password"><input id="password" name="password" type="password" autocomplete="current-password" required><button type="button" id="show">Show</button></span></label>
                 <button class="button" type="submit">Sign in</button>
               </form>
               <script>document.getElementById('show').addEventListener('click',e=>{const p=document.getElementById('password');p.type=p.type==='password'?'text':'password';e.currentTarget.textContent=p.type==='password'?'Show':'Hide';});</script>
               """);

    public static string Setup(string csrf, string? error = null) => Page("Set up", $$"""
        <h1>Create administrator</h1><p>No default credentials are created. This account controls VynodeArr.</p>
        {{Error(error)}}
        <form method="post" action="/api/auth/setup">
          <input type="hidden" name="__RequestVerificationToken" value="{{E(csrf)}}">
          <label>Username<input name="username" autocomplete="username" minlength="3" maxlength="64" required autofocus></label>
          <label>Email <small>(optional)</small><input name="email" type="email" autocomplete="email"></label>
          <label>Password<input name="password" type="password" autocomplete="new-password" minlength="12" required></label>
          <label>Confirm password<input name="confirmation" type="password" autocomplete="new-password" minlength="12" required></label>
          <button class="button" type="submit">Create administrator</button>
        </form>
        """);

    private static string Page(string title, string body) => $$"""
        <!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <meta name="color-scheme" content="dark light"><title>{{E(title)}} · VynodeArr</title><link rel="icon" type="image/png" href="/assets/vynodearr.png"><link rel="stylesheet" href="/assets/vynodearr-tokens.v1.css?rev=2">
        <style>*{box-sizing:border-box}html{background:var(--vy-surface-app,#17191c);color:var(--vy-text-primary,#f3f4f6);font-family:Inter,"Segoe UI",sans-serif}body{min-height:100vh;margin:0;display:grid;place-items:center;padding:20px}main{width:min(420px,100%);padding:28px;border:1px solid var(--vy-border-subtle,#41464d);border-radius:10px;background:var(--vy-surface-panel,#1d2024);box-shadow:0 12px 35px #0005}header{display:flex;align-items:center;gap:12px;margin-bottom:24px}header img{width:48px;height:48px;border-radius:8px}header strong{font-size:1.2rem}h1{font-size:1.5rem;margin:0 0 6px}p{color:var(--vy-text-secondary,#aeb4bd);line-height:1.5;margin:0 0 20px}form{display:grid;gap:16px}label{display:grid;gap:6px;font-weight:600}input{width:100%;min-height:44px;padding:9px 11px;color:inherit;border:1px solid var(--vy-border-strong,#555c65);border-radius:5px;background:var(--vy-surface-app,#17191c);font:inherit}input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid var(--vy-focus,#78a9ff);outline-offset:2px}.password{display:flex}.password input{border-radius:5px 0 0 5px}.password button{border-radius:0 5px 5px 0}button,.button{min-height:44px;padding:10px 14px;color:#fff;border:1px solid #518cd8;border-radius:5px;background:#2868b2;font:inherit;font-weight:700;text-align:center;text-decoration:none;cursor:pointer}.password button{border-color:var(--vy-border-strong,#555c65);background:var(--vy-surface-elevated,#30353b)}.error{padding:11px;border:1px solid #fb7185;border-radius:5px;color:#fecdd3;background:#4c1d242b}small{font-weight:400;color:var(--vy-text-muted,#96a1af)}</style></head>
        <body><main><header><img src="/assets/vynodearr.png" alt=""><strong>VynodeArr</strong></header>{{body}}</main></body></html>
        """;
    private static string Error(string? value) => value is null ? "" : $"<p class=\"error\" role=\"alert\">{E(value)}</p>";
    private static string E(string? value) => WebUtility.HtmlEncode(value ?? "");
}
