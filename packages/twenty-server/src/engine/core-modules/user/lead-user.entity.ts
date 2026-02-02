import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
  RelationId,
  UpdateDateColumn,
} from 'typeorm';
// import { AccountEntity } from '../account/account.entity'; // opcional si existe

export enum LeadSource {
  WHATSAPP = 'whatsapp',
  LINKEDIN = 'linkedin',
  EMAIL = 'email',
}

@Entity({ name: 'lead_user', schema: 'core' })
@Index(['email', 'source'], { unique: true })
export class LeadUserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: LeadSource })
  source: LeadSource;

  // provider-specific identifiers
  @Column({ nullable: true })
  providerAccountId: string; // id del proveedor (ej. linkedin id)

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true })
  accessToken: string;

  @Column()
  email: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  // si tenés AccountEntity, mejor ManyToOne; si no, mantiene accountId como string
  @Column({ nullable: true })
  accountId: string;

// RELACIÓN CON USER (Usando string para evitar el circular)
  @ManyToOne('UserEntity', 'leads', { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: Relation<any>; // Usamos any o el tipo importado como 'type'

  @RelationId((lead: LeadUserEntity) => lead.user)
  userId?: string;

  // RELACIÓN CON WORKSPACE (Igual, usando string)
  @ManyToOne('WorkspaceEntity', { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Relation<any>;

  @RelationId((lead: LeadUserEntity) => lead.workspace)
  workspaceId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
