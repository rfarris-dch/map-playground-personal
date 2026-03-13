export interface DonutChartInputSegment {
  readonly color: string;
  readonly value: number;
}

export interface DonutChartArcSegment {
  readonly color: string;
  readonly path: string | null;
}

const FULL_CIRCLE_DEGREES = 360;
const FULL_CIRCLE_THRESHOLD_DEGREES = 359.999;

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleDegrees: number
): {
  readonly x: number;
  readonly y: number;
} {
  const angleRadians = ((angleDegrees - 90) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleRadians),
    y: centerY + radius * Math.sin(angleRadians),
  };
}

function buildArcPath(args: {
  readonly centerX: number;
  readonly centerY: number;
  readonly endAngleDegrees: number;
  readonly radius: number;
  readonly startAngleDegrees: number;
}): string {
  const start = polarToCartesian(args.centerX, args.centerY, args.radius, args.startAngleDegrees);
  const end = polarToCartesian(args.centerX, args.centerY, args.radius, args.endAngleDegrees);
  const largeArcFlag = args.endAngleDegrees - args.startAngleDegrees > 180 ? 1 : 0;

  return `M ${String(start.x)} ${String(start.y)} A ${String(args.radius)} ${String(args.radius)} 0 ${String(largeArcFlag)} 1 ${String(end.x)} ${String(end.y)}`;
}

export function buildDonutChartArcSegments(args: {
  readonly centerX: number;
  readonly centerY: number;
  readonly radius: number;
  readonly segments: readonly DonutChartInputSegment[];
}): readonly DonutChartArcSegment[] {
  const visibleSegments = args.segments.filter((segment) => segment.value > 0);
  const total = visibleSegments.reduce((sum, segment) => sum + segment.value, 0);
  if (total <= 0) {
    return [];
  }

  let currentAngleDegrees = 0;

  return visibleSegments.map((segment) => {
    const sweepDegrees = (segment.value / total) * FULL_CIRCLE_DEGREES;
    const startAngleDegrees = currentAngleDegrees;
    currentAngleDegrees += sweepDegrees;

    if (sweepDegrees >= FULL_CIRCLE_THRESHOLD_DEGREES) {
      return {
        color: segment.color,
        path: null,
      };
    }

    return {
      color: segment.color,
      path: buildArcPath({
        centerX: args.centerX,
        centerY: args.centerY,
        endAngleDegrees: currentAngleDegrees,
        radius: args.radius,
        startAngleDegrees,
      }),
    };
  });
}
