export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: "super_admin" | "admin";
};
