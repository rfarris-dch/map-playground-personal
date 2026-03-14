import type { FeatureStateTarget, IMap, MapPointerEvent } from "@map-migration/map-engine";

interface FeatureHoverCandidate<THoverState> {
  readonly nextHover: THoverState;
  readonly nextTarget: FeatureStateTarget | null;
}

interface CreateFeatureHoverControllerOptions<THoverState> {
  readonly autoBind?: boolean | undefined;
  readonly isInteractionEnabled?: (() => boolean) | undefined;
  readonly onHoverChange?: ((nextHover: THoverState | null) => void) | undefined;
  readonly resolveHoverCandidate: (
    event: MapPointerEvent
  ) => FeatureHoverCandidate<THoverState> | null;
}

function isSameFeatureStateTarget(
  left: FeatureStateTarget | null,
  right: FeatureStateTarget
): boolean {
  if (left === null) {
    return false;
  }

  return (
    left.id === right.id &&
    left.source === right.source &&
    (left.sourceLayer ?? null) === (right.sourceLayer ?? null)
  );
}

export function createFeatureHoverController<THoverState>(
  map: IMap,
  options: CreateFeatureHoverControllerOptions<THoverState>
): {
  clear: (options?: { readonly emit?: boolean }) => void;
  destroy: () => void;
  handlePointerLeave: () => void;
  handlePointerMove: (event: MapPointerEvent) => void;
} {
  const shouldAutoBind = options.autoBind ?? true;
  let hoverTarget: FeatureStateTarget | null = null;

  const clearFeatureState = (): void => {
    if (hoverTarget === null) {
      return;
    }

    map.setFeatureState(hoverTarget, { hover: false });
    hoverTarget = null;
  };

  const clear = (clearOptions: { readonly emit?: boolean } = {}): void => {
    const shouldEmit = clearOptions.emit ?? true;
    clearFeatureState();
    if (shouldEmit) {
      options.onHoverChange?.(null);
    }
  };

  const handlePointerLeave = (): void => {
    clear();
  };

  const handlePointerMove = (event: MapPointerEvent): void => {
    if (!(options.isInteractionEnabled?.() ?? true) || event.buttons > 0) {
      clear();
      return;
    }

    const candidate = options.resolveHoverCandidate(event);
    if (candidate === null) {
      clear();
      return;
    }

    if (
      candidate.nextTarget !== null &&
      isSameFeatureStateTarget(hoverTarget, candidate.nextTarget)
    ) {
      options.onHoverChange?.(candidate.nextHover);
      return;
    }

    if (candidate.nextTarget === null && hoverTarget === null) {
      options.onHoverChange?.(candidate.nextHover);
      return;
    }

    clearFeatureState();

    if (candidate.nextTarget !== null) {
      map.setFeatureState(candidate.nextTarget, { hover: true });
      hoverTarget = candidate.nextTarget;
    }

    options.onHoverChange?.(candidate.nextHover);
  };

  if (shouldAutoBind) {
    map.onPointerMove(handlePointerMove);
    map.onPointerLeave(handlePointerLeave);
  }

  return {
    clear,
    handlePointerLeave,
    handlePointerMove,
    destroy(): void {
      clear();
      if (shouldAutoBind) {
        map.offPointerMove(handlePointerMove);
        map.offPointerLeave(handlePointerLeave);
      }
    },
  };
}
