import { type QueryRunner } from 'typeorm';

import { generateRandomUsers } from './generate-random-users.util';

const tableName = 'user';

export const USER_DATA_SEED_IDS = {
  JANE: '20202020-e6b5-4680-8a32-b8209737156b',
  TIM: '20202020-9e3b-46d4-a556-88b9ddc2b034',
  JONY: '20202020-3957-4908-9c36-2929a23f8357',
  PHIL: '20202020-7169-42cf-bc47-1cfef15264b8',
  JORGE: '20202020-a1b2-4c3d-8e5f-1234567890ab',
  SYMBIOSE: '20202020-e5f6-4a7b-c2d9-5678901234ef',
};

const { users: randomUsers, userIds: randomUserIds } = generateRandomUsers();

export const RANDOM_USER_IDS = randomUserIds;

type SeedUsersArgs = {
  queryRunner: QueryRunner;
  schemaName: string;
};

export const seedUsers = async ({ queryRunner, schemaName }: SeedUsersArgs) => {
  const originalUsers = [
    {
      id: USER_DATA_SEED_IDS.TIM,
      firstName: 'Tim',
      lastName: 'Apple',
      email: 'tim@apple.dev',
      passwordHash:
        '$2b$10$3LwXjJRtLsfx4hLuuXhxt.3mWgismTiZFCZSG3z9kDrSfsrBl0fT6', // tim@apple.dev
      canImpersonate: true,
      canAccessFullAdminPanel: true,
      isEmailVerified: true,
    },
    {
      id: USER_DATA_SEED_IDS.JONY,
      firstName: 'Jony',
      lastName: 'Ive',
      email: 'jony.ive@apple.dev',
      passwordHash:
        '$2b$10$3LwXjJRtLsfx4hLuuXhxt.3mWgismTiZFCZSG3z9kDrSfsrBl0fT6', // tim@apple.dev
      canImpersonate: true,
      canAccessFullAdminPanel: true,
      isEmailVerified: true,
    },
    {
      id: USER_DATA_SEED_IDS.PHIL,
      firstName: 'Phil',
      lastName: 'Schiler',
      email: 'phil.schiler@apple.dev',
      passwordHash:
        '$2b$10$3LwXjJRtLsfx4hLuuXhxt.3mWgismTiZFCZSG3z9kDrSfsrBl0fT6', // tim@apple.dev
      canImpersonate: true,
      canAccessFullAdminPanel: true,
      isEmailVerified: true,
    },
    {
      id: USER_DATA_SEED_IDS.JANE,
      firstName: 'Jane',
      lastName: 'Austen',
      email: 'jane.austen@apple.dev',
      passwordHash:
        '$2b$10$3LwXjJRtLsfx4hLuuXhxt.3mWgismTiZFCZSG3z9kDrSfsrBl0fT6', // tim@apple.dev
      canImpersonate: true,
      canAccessFullAdminPanel: true,
      isEmailVerified: true,
    },
    {
      id: USER_DATA_SEED_IDS.JORGE,
      firstName: 'Jorge',
      lastName: 'Dev',
      email: 'jorge@apple.dev',
      passwordHash:
        '$2b$10$3LwXjJRtLsfx4hLuuXhxt.3mWgismTiZFCZSG3z9kDrSfsrBl0fT6', // tim@apple.dev
      canImpersonate: true,
      canAccessFullAdminPanel: true,
      isEmailVerified: true,
    },
    {
      id: USER_DATA_SEED_IDS.SYMBIOSE,
      firstName: 'Symbiose',
      lastName: 'User',
      email: 'symbiose@apple.dev',
      passwordHash:
        '$2b$10$k99/3lnC.Jiaf2wqF53EhexvevGDGyP8GYyEepV3GhCnx/dGc.G0S', // 123456
      canImpersonate: true,
      canAccessFullAdminPanel: true,
      isEmailVerified: true,
    },
  ];

  const allUsers = [...originalUsers, ...randomUsers];

  await queryRunner.manager
    .createQueryBuilder()
    .insert()
    .into(`${schemaName}.${tableName}`, [
      'id',
      'firstName',
      'lastName',
      'email',
      'passwordHash',
      'canImpersonate',
      'canAccessFullAdminPanel',
      'isEmailVerified',
    ])
    .orIgnore()
    .values(allUsers)
    .execute();
};
