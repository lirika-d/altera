export type KnowledgeEntityType = 'note' | 'resource' | 'project' | 'task' | 'session'
export type ResourceType = 'link' | 'snippet' | 'file'

export interface Note {
  id: string
  title: string
  contentJSON: string
  plainText: string
  isFavorite: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
  revision: number
  projectId?: string
}

export interface Resource {
  id: string
  type: ResourceType
  title: string
  description?: string
  url?: string
  snippetContent?: string
  language?: string
  attachmentId?: string
  isFavorite: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
  projectId?: string
}

export interface Attachment {
  id: string
  filename: string
  mimeType: string
  size: number
  blob: Blob
  createdAt: Date
}

export interface Tag {
  id: string
  name: string
  normalizedName: string
  color: string
  createdAt: Date
}

export interface TagAssignment {
  id: string
  tagId: string
  entityType: KnowledgeEntityType
  entityId: string
}

export interface EntityLink {
  id: string
  sourceType: KnowledgeEntityType
  sourceId: string
  targetType: KnowledgeEntityType
  targetId: string
  createdAt: Date
}

export interface CreateNoteInput {
  title: string
  contentJSON?: string
  plainText?: string
  isFavorite?: boolean
  projectId?: string
  tagIds?: string[]
}

export interface UpdateNoteInput {
  title?: string
  contentJSON?: string
  plainText?: string
  isFavorite?: boolean
  projectId?: string | null
  tagIds?: string[]
  expectedRevision?: number
}

export interface CreateResourceInput {
  type: ResourceType
  title: string
  description?: string
  url?: string
  snippetContent?: string
  language?: string
  attachmentId?: string
  isFavorite?: boolean
  projectId?: string
  tagIds?: string[]
}

export interface UpdateResourceInput {
  type?: ResourceType
  title?: string
  description?: string
  url?: string
  snippetContent?: string
  language?: string
  attachmentId?: string
  isFavorite?: boolean
  projectId?: string | null
  tagIds?: string[]
}

export interface CreateTagInput {
  name: string
  color?: string
}

export interface NoteFilterOptions {
  projectId?: string
  tagId?: string
  isFavorite?: boolean
  showTrash?: boolean
  search?: string
}

export interface ResourceFilterOptions {
  projectId?: string
  type?: ResourceType
  tagId?: string
  isFavorite?: boolean
  showTrash?: boolean
  search?: string
}

export interface KnowledgeCounts {
  notes: number
  resources: number
  trash: number
  favorites: number
}

export interface EntityLinkWithTarget extends EntityLink {
  direction: 'outgoing' | 'incoming'
  otherType: KnowledgeEntityType
  otherId: string
}

export interface EntityLinksResult {
  outgoing: EntityLink[]
  incoming: EntityLink[]
  all: EntityLink[]
}
