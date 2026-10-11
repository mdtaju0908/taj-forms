declare module '@dnd-kit/core' {
  export type UniqueIdentifier = string | number
  export interface ClientRect extends DOMRectReadOnly {}
  export interface Active { id: UniqueIdentifier }
  export interface Over { id: UniqueIdentifier }
  export interface DraggableAttributes { [attribute: string]: unknown }
  export interface UseDraggableArguments {
    id: UniqueIdentifier
    data?: Record<string, unknown>
    attributes?: Record<string, string>
    disabled?: boolean
  }
  export interface UseDroppableArguments {
    resizeObserverConfig?: { disabled?: boolean; updateMeasurementsFor?: UniqueIdentifier[] }
  }

  export interface DragEndEvent {
    active: { id: UniqueIdentifier }
    over: { id: UniqueIdentifier } | null
  }

  export const DndContext: import('react').ComponentType<{
    children?: import('react').ReactNode
    sensors?: unknown
    collisionDetection?: unknown
    onDragEnd?: (event: DragEndEvent) => void
  }>

  export const KeyboardSensor: unknown
  export const PointerSensor: unknown
  export const closestCenter: unknown
  export function useSensor(sensor: unknown, options?: Record<string, unknown>): unknown
  export function useSensors(...sensors: unknown[]): unknown
}
