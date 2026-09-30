"use client";

// A drag-and-drop S/A/B/C/D tier list, used for both "Songs I've heard live" and custom lists.
// Built with dnd-kit: DndContext watches the drag, each tier is a SortableContext (a reorderable
// list), and each song is a sortable item that can move within its tier or into another one.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  TouchSensor,
  closestCorners,
  getFirstCollision,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { RankItem } from "@/lib/types";
import {
  TIER_COLORS,
  TIER_NAMES,
  buildBoard,
  boardToTiers,
  moveToTier,
  type Board,
  type ContainerId,
  type TierName,
  type Tiers,
} from "@/lib/tiers";

type Props = {
  items: RankItem[];
  tiers: Tiers;
  onChange: (tiers: Tiers) => void;
  onRemoveItem?: (key: string) => void; // only custom lists allow removing songs
};

const CONTAINERS: ContainerId[] = [...TIER_NAMES, "unranked"];

export default function TierBoard({ items, tiers, onChange, onRemoveItem }: Props) {
  // The saved board (tiers + everything else as "unranked")
  const savedBoard = useMemo(() => buildBoard(items, tiers), [items, tiers]);

  // While dragging, a temporary copy of the board shows songs moving between tiers.
  // It's only saved when the drag ends, so a cancelled drag changes nothing.
  const [dragBoard, setDragBoard] = useState<Board | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const board = dragBoard ?? savedBoard;
  const itemsByKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items]);

  // ---- Preventing the "bouncing" loop ----
  // Moving a song into another tier changes the tiers' sizes, which shifts the layout under the pointer.
  // Without protection, a different tier can end up under the pointer, the song moves again, the layout
  // shifts again... forever (React's "Maximum update depth exceeded" error).
  // Fix: right after a move, freeze the drop target until the layout has settled (one animation frame).
  const lastOverId = useRef<UniqueIdentifier | null>(null); // the last valid drop target
  const justMoved = useRef(false);

  // Unfreeze once the browser has drawn the new layout
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      justMoved.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [dragBoard]);

  // Decides what the dragged song is "over":
  //  - just after a move: keep the previous target (the freeze)
  //  - otherwise: whatever is directly under the pointer, or the nearest corners if nothing is
  //    (e.g. keyboard dragging, which has no pointer)
  //  - over a gap between tiers: keep the last target, so the song doesn't jump
  const collisionDetection: CollisionDetection = useCallback((args) => {
    if (justMoved.current && lastOverId.current !== null) {
      return [{ id: lastOverId.current }];
    }
    const underPointer = pointerWithin(args);
    const overId = getFirstCollision(underPointer.length > 0 ? underPointer : closestCorners(args), "id");
    if (overId !== null) lastOverId.current = overId;
    return lastOverId.current !== null ? [{ id: lastOverId.current }] : [];
  }, []);

  // Sensors decide what starts a drag:
  // - mouse: moving 5px (so a normal click on a button inside a card still works)
  // - touch: press and hold for 200ms (so normal scrolling on phones still works)
  // - keyboard: focus a card, press Space, move with arrow keys, Space to drop
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Which container (tier or unranked) is this id? It's either a container's own id or a song inside one.
  function findContainer(b: Board, id: string): ContainerId | undefined {
    if ((CONTAINERS as string[]).includes(id)) return id as ContainerId;
    return CONTAINERS.find((c) => b[c].includes(id));
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveKey(String(active.id));
    setDragBoard(savedBoard);
    lastOverId.current = null;
  }

  // Fires as the dragged song passes over other songs or tiers. Moving into a different
  // tier happens here, so the song visibly jumps into the new tier while you're still dragging.
  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over || !dragBoard) return;
    const activeId = String(active.id);
    const from = findContainer(dragBoard, activeId);
    const to = findContainer(dragBoard, String(over.id));
    if (!from || !to || from === to) return; // same tier: nothing to update (reordering happens on drop)

    const toList = dragBoard[to].filter((k) => k !== activeId);
    const overIndex = toList.indexOf(String(over.id));
    // Over a song: insert at its position. Over the tier's empty space: add to the end.
    toList.splice(overIndex >= 0 ? overIndex : toList.length, 0, activeId);

    justMoved.current = true; // freeze the drop target until the new layout settles
    setDragBoard({ ...dragBoard, [from]: dragBoard[from].filter((k) => k !== activeId), [to]: toList });
  }

  // Fires when the song is dropped: finish reordering within the tier, then save
  function handleDragEnd({ active, over }: DragEndEvent) {
    let final = dragBoard ?? savedBoard;
    if (over) {
      const container = findContainer(final, String(active.id));
      if (container && container === findContainer(final, String(over.id))) {
        const list = final[container];
        const oldIndex = list.indexOf(String(active.id));
        const newIndex = list.indexOf(String(over.id));
        if (oldIndex !== newIndex && newIndex >= 0) {
          final = { ...final, [container]: arrayMove(list, oldIndex, newIndex) };
        }
      }
    }
    onChange(boardToTiers(final));
    setDragBoard(null);
    setActiveKey(null);
  }

  function handleDragCancel() {
    setDragBoard(null);
    setActiveKey(null);
  }

  const rankedCount = items.length - board.unranked.length;

  return (
    <div>
      <div className="stats">
        <span className="pill">
          {rankedCount} of {items.length} ranked
        </span>
        <span className="pill">Drag songs, or tap a letter</span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        // Re-measure where every tier is throughout the drag, since tiers grow and shrink as songs move
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="tier-board">
          {CONTAINERS.map((container) => (
            <TierRow
              key={container}
              id={container}
              keys={board[container]}
            >
              {board[container].map((key) => (
                <SongCard
                  key={key}
                  id={key}
                  item={itemsByKey.get(key)}
                  onQuickTier={
                    container === "unranked"
                      ? (tier) => onChange(moveToTier(boardToTiers(board), key, tier))
                      : undefined
                  }
                  onRemove={onRemoveItem ? () => onRemoveItem(key) : undefined}
                />
              ))}
            </TierRow>
          ))}
        </div>

        {/* DragOverlay: the floating copy of the card that follows your pointer while dragging */}
        <DragOverlay>
          {activeKey ? <CardBody item={itemsByKey.get(activeKey)} className="lifted" style={{ cursor: "grabbing" }} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// One tier (or the unranked area). The whole row is a drop target, so there's a big area to aim for.
function TierRow(props: { id: ContainerId; keys: string[]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: props.id });
  const isTier = props.id !== "unranked";

  return (
    <div ref={setNodeRef} className={`tier-row ${isOver ? "over" : ""}`}>
      <div className="tier-label">
        <div
          className={`tier-letter ${isTier ? "" : "unranked"}`}
          style={isTier ? { background: TIER_COLORS[props.id as TierName] } : undefined}
        >
          {isTier ? props.id : "new"}
        </div>
        <span className="tier-count">{props.keys.length}</span>
      </div>
      <SortableContext id={props.id} items={props.keys} strategy={rectSortingStrategy}>
        <div className="tier-drop">
          {props.children}
          {props.keys.length === 0 && (
            <span className="muted" style={{ fontSize: 13, alignSelf: "center" }}>
              {isTier ? "Drop songs here" : "All songs ranked!"}
            </span>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// Buttons inside a draggable card shouldn't start a drag when pressed (by mouse, touch, or keyboard).
// Stopping the event here means it never reaches the card's drag listeners.
const noDrag = {
  onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation(),
};

// One draggable song. useSortable gives it drag handlers and the animation as it moves.
function SongCard(props: {
  id: string;
  item?: RankItem;
  onQuickTier?: (tier: TierName) => void;
  onRemove?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.id });

  const hasActions = props.onQuickTier || props.onRemove;

  return (
    <CardBody
      item={props.item}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1, // the original card fades while its floating copy is dragged
        cursor: "grab",
        touchAction: "manipulation",
      }}
      {...attributes}
      {...listeners}
    >
      {hasActions && (
        <div className="chip-actions">
          {props.onQuickTier &&
            TIER_NAMES.map((tier) => (
              <button
                key={tier}
                className="tier-btn"
                style={{ background: TIER_COLORS[tier] }}
                onClick={() => props.onQuickTier!(tier)}
                {...noDrag}
              >
                {tier}
              </button>
            ))}
          {props.onRemove && (
            <button className="remove-btn" onClick={props.onRemove} title="Remove from this list" {...noDrag}>
              ×
            </button>
          )}
        </div>
      )}
    </CardBody>
  );
}

// The card's appearance, shared by the real card and the floating drag copy
function CardBody({
  item,
  children,
  className = "",
  ref,
  ...rest
}: {
  item?: RankItem;
  children?: React.ReactNode;
  className?: string;
  ref?: React.Ref<HTMLDivElement>;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div ref={ref} className={`song-chip ${className}`} {...rest}>
      <div className="song-chip-name">{item?.name ?? "Unknown song"}</div>
      <div className="song-chip-meta">
        {item?.artist}
        {item?.detail && ` · ${item.detail}`}
      </div>
      {children}
    </div>
  );
}
