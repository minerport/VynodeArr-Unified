export type SetupCenterSection="overview"|"search"|"integrations";

export interface SetupCenterMountOptions{
  section:SetupCenterSection;
  administrator:boolean;
}
