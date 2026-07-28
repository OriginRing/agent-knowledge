export interface PasswordChangeFields {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export const validatePasswordChange = (
  fields: PasswordChangeFields,
): string | null => {
  const hasInput =
    fields.currentPassword || fields.newPassword || fields.confirmPassword;
  if (!hasInput) return null;
  if (!fields.currentPassword) return "请输入当前密码";
  if (fields.newPassword.length < 6) return "新密码至少需要 6 位";
  if (fields.newPassword !== fields.confirmPassword)
    return "两次输入的新密码不一致";
  return null;
};
