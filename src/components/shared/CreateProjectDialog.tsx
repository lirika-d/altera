import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/store/useAppStore'
import { createProject, getNextProjectIdentifier } from '@/db/db'
import type { ProjectStatus, Priority } from '@/types'

const ICON_PRESETS = ['⚡', '🎨', '📚', '📊', '🚀', '🔄', '💡', '🎯', '🛠️', '🔒', '📱', '🌐']
const COLOR_PRESETS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#64748b', // slate
]

export function CreateProjectDialog() {
  const { isCreateProjectOpen, setIsCreateProjectOpen } = useAppStore()
  const navigate = useNavigate()

  const [name, setName] = React.useState('')
  const [identifier, setIdentifier] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [status, setStatus] = React.useState<ProjectStatus>('active')
  const [priority, setPriority] = React.useState<Priority>('medium')
  const [nextAction, setNextAction] = React.useState('')
  const [icon, setIcon] = React.useState('⚡')
  const [color, setColor] = React.useState('#3b82f6')
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const resetForm = React.useCallback(() => {
    setName('')
    setDescription('')
    setStatus('active')
    setPriority('medium')
    setNextAction('')
    setIcon('⚡')
    setColor('#3b82f6')
  }, [])

  // Auto-generate identifier on dialog open
  React.useEffect(() => {
    if (isCreateProjectOpen) {
      void getNextProjectIdentifier().then((id) => setIdentifier(id))
    }
  }, [isCreateProjectOpen])

  const handleOpenChange = (open: boolean) => {
    setIsCreateProjectOpen(open)
    if (!open) {
      resetForm()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsSubmitting(true)
    try {
      const created = await createProject({
        name: name.trim(),
        identifier: identifier.trim() || undefined,
        description: description.trim(),
        status,
        priority,
        nextAction: nextAction.trim(),
        icon,
        color,
      })
      resetForm()
      setIsCreateProjectOpen(false)
      navigate(`/projects/${created.id}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isCreateProjectOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Add a new initiative to your workspace with an initial next action.
            </DialogDescription>
          </DialogHeader>

          {/* Icon & Name */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-text-secondary">
              Project Name
            </label>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded border border-border bg-bg-base text-sm shrink-0">
                {icon}
              </span>
              <Input
                autoFocus
                placeholder="e.g. Core Engine Architecture"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Identifier & Status & Priority */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-text-secondary">
                ID
              </label>
              <Input
                className="font-mono text-xs uppercase"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="ALT-001"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-text-secondary">
                Status
              </label>
              <Select
                value={status}
                onValueChange={(val) => setStatus(val as ProjectStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="backlog">Backlog</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-text-secondary">
                Priority
              </label>
              <Select
                value={priority}
                onValueChange={(val) => setPriority(val as Priority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Next Action Prominent Field */}
          <div className="space-y-1.5 p-2.5 rounded-md bg-accent-blue/5 border border-accent-blue/20">
            <label className="text-[11px] font-semibold text-accent-blue flex items-center gap-1">
              <span>Next Action</span>
              <span className="text-text-muted font-normal">(Crucial first step)</span>
            </label>
            <Input
              placeholder="What is the very next thing to do?"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              className="border-accent-blue/30 focus-visible:border-accent-blue"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-text-secondary">
              Description
            </label>
            <Textarea
              placeholder="What is the goal and scope of this project?"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Icon & Color selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-text-secondary">
                Icon Preset
              </span>
              <div className="flex gap-1">
                {ICON_PRESETS.slice(0, 8).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setIcon(p)}
                    className={`h-6 w-6 rounded text-xs flex items-center justify-center border transition-colors ${
                      icon === p ? 'border-accent-blue bg-bg-elevated' : 'border-transparent hover:bg-bg-hover'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-text-secondary">
                Theme Color
              </span>
              <div className="flex gap-1.5 items-center">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-4 w-4 rounded-full transition-transform ${
                      color === c ? 'scale-125 ring-2 ring-white/50' : 'hover:scale-110 opacity-70'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsCreateProjectOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isSubmitting}>
              Create Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
