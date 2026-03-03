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

export enum EnrichmentStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum EnrichmentProvider {
  FULL_ENRICH = 'full_enrich',
}

@Entity({ name: 'personEnrichmentTracking', schema: 'core' })
@Index(['workspaceId', 'personId'])
export class PersonEnrichmentTrackingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Reference to workspace (FK to core.workspace)
  @ManyToOne('WorkspaceEntity', { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Relation<any>;

  @RelationId(
    (tracking: PersonEnrichmentTrackingEntity) => tracking.workspace,
  )
  @Column('uuid')
  workspaceId: string;

  // Reference to person in workspace schema (NOT a FK, just string reference)
  @Column('uuid')
  personId: string;

  // Enrichment metadata
  @Column({ type: 'enum', enum: EnrichmentProvider })
  provider: EnrichmentProvider;

  @Column({ type: 'enum', enum: EnrichmentStatus, default: EnrichmentStatus.PENDING })
  status: EnrichmentStatus;

  @Column({ type: 'jsonb', nullable: true })
  enrichmentData: any;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastEnrichedAt: Date;

  // Reference to user who triggered enrichment
  @ManyToOne('UserEntity', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'enrichedBy' })
  enrichedByUser?: Relation<any>;

  @RelationId(
    (tracking: PersonEnrichmentTrackingEntity) => tracking.enrichedByUser,
  )
  enrichedBy?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
