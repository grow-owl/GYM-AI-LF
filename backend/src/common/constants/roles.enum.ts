export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  GYM_OWNER = 'GYM_OWNER',
  BRANCH_MANAGER = 'BRANCH_MANAGER',
  TRAINER = 'TRAINER',
  MEMBER = 'MEMBER',
  KIOSK = 'KIOSK', // Reception kiosk scan terminal pseudo-role
}

export type RoleType = `${Role}`;
