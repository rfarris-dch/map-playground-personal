import type {
  SpatialAnalysisHistoryChartLine,
  SpatialAnalysisHistoryChartModel,
  SpatialAnalysisHistoryChartPoint,
  SpatialAnalysisHistoryChartTick,
  SpatialAnalysisHistoryModel,
  SpatialAnalysisHistoryPointModel,
  SpatialAnalysisHistorySeriesDefinition,
  SpatialAnalysisHistorySeriesKey,
} from "@/features/spatial-analysis/spatial-analysis-history.types";

const CHART_HEIGHT = 220;
const CHART_WIDTH = 720;
const PADDING_BOTTOM = 28;
const PADDING_LEFT = 24;
const PADDING_RIGHT = 24;
const PADDING_TOP = 12;
const SECONDARY_AXIS_RATIO_THRESHOLD = 8;

export function listSpatialAnalysisHistorySeries(): readonly SpatialAnalysisHistorySeriesDefinition[] {
  return [
    {
      color: "#0f766e",
      defaultVisible: true,
      key: "totalMarketSizeMw",
      label: "Total Market Size",
    },
    {
      color: "#2563eb",
      defaultVisible: true,
      key: "colocationCommissionedMw",
      label: "Colo Commissioned",
    },
    {
      color: "#f97316",
      defaultVisible: true,
      key: "hyperscaleOwnedMw",
      label: "Hyperscale Owned",
    },
    {
      color: "#7c3aed",
      defaultVisible: false,
      key: "colocationAvailableMw",
      label: "Colo Available",
    },
    {
      color: "#0369a1",
      defaultVisible: false,
      key: "colocationUnderConstructionMw",
      label: "Colo Under Construction",
    },
    {
      color: "#38bdf8",
      defaultVisible: false,
      key: "colocationPlannedMw",
      label: "Colo Planned",
    },
    {
      color: "#c2410c",
      defaultVisible: false,
      key: "hyperscaleUnderConstructionMw",
      label: "Hyperscale Under Construction",
    },
    {
      color: "#fdba74",
      defaultVisible: false,
      key: "hyperscalePlannedMw",
      label: "Hyperscale Planned",
    },
  ];
}

function readHistoryPointValue(
  point: SpatialAnalysisHistoryPointModel,
  key: SpatialAnalysisHistorySeriesKey
): number {
  return point[key];
}

function buildEmptyChartModel(
  definitions: readonly SpatialAnalysisHistorySeriesDefinition[]
): SpatialAnalysisHistoryChartModel {
  const latestLines: SpatialAnalysisHistoryChartLine[] = definitions.map((definition) => ({
    axis: "primary",
    color: definition.color,
    key: definition.key,
    label: definition.label,
    path: "",
    points: [],
    valueAtLatestPoint: 0,
  }));

  return {
    lines: latestLines,
    points: [],
    ticks: [],
    yMaxPrimary: 0,
    yMaxSecondary: null,
  };
}

function buildYTicks(args: {
  readonly axis: "primary" | "secondary";
  readonly yMax: number;
}): readonly SpatialAnalysisHistoryChartTick[] {
  const yMax = args.yMax;
  if (yMax <= 0) {
    return [];
  }

  const step = yMax / 3;
  const ticks: SpatialAnalysisHistoryChartTick[] = [];
  for (let index = 0; index <= 3; index += 1) {
    const value = step * index;
    const plotHeight = CHART_HEIGHT - PADDING_BOTTOM - PADDING_TOP;
    const y = CHART_HEIGHT - PADDING_BOTTOM - (value / yMax) * plotHeight;
    ticks.push({
      axis: args.axis,
      label: Math.round(value).toLocaleString(),
      y,
    });
  }

  return ticks.reverse();
}

function buildChartPoints(
  points: readonly SpatialAnalysisHistoryPointModel[]
): readonly SpatialAnalysisHistoryChartPoint[] {
  if (points.length === 0) {
    return [];
  }

  const plotWidth = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;
  if (points.length === 1) {
    const onlyPoint = points[0];
    if (typeof onlyPoint === "undefined") {
      return [];
    }

    return [
      {
        label: onlyPoint.periodLabel,
        x: PADDING_LEFT + plotWidth / 2,
      },
    ];
  }

  return points.map((point, index) => ({
    label: point.periodLabel,
    x: PADDING_LEFT + (plotWidth * index) / (points.length - 1),
  }));
}

function buildSeriesPointCoordinates(args: {
  readonly key: SpatialAnalysisHistorySeriesKey;
  readonly points: readonly SpatialAnalysisHistoryPointModel[];
  readonly xPoints: readonly SpatialAnalysisHistoryChartPoint[];
  readonly yMax: number;
}): readonly {
  readonly x: number;
  readonly y: number;
}[] {
  if (args.points.length === 0 || args.yMax <= 0) {
    return [];
  }

  const plotHeight = CHART_HEIGHT - PADDING_BOTTOM - PADDING_TOP;
  return args.points.map((point, index) => {
    const value = readHistoryPointValue(point, args.key);
    const x = args.xPoints[index]?.x ?? PADDING_LEFT;
    const y = CHART_HEIGHT - PADDING_BOTTOM - (value / args.yMax) * plotHeight;
    return { x, y };
  });
}

function buildLinePath(args: {
  readonly linePoints: readonly {
    readonly x: number;
    readonly y: number;
  }[];
}): string {
  if (args.linePoints.length === 0) {
    return "";
  }

  return args.linePoints
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command}${point.x.toFixed(2)},${point.y.toFixed(2)}`;
    })
    .join(" ");
}

function determineSecondaryAxisKeys(args: {
  readonly definitions: readonly SpatialAnalysisHistorySeriesDefinition[];
  readonly history: SpatialAnalysisHistoryModel;
}): ReadonlySet<SpatialAnalysisHistorySeriesKey> {
  const seriesMaxEntries = args.definitions.map((definition) => ({
    key: definition.key,
    maxValue: Math.max(
      0,
      ...args.history.points.map((point) => readHistoryPointValue(point, definition.key))
    ),
  }));

  const overallMax = Math.max(...seriesMaxEntries.map((entry) => entry.maxValue));
  if (overallMax <= 0) {
    return new Set<SpatialAnalysisHistorySeriesKey>();
  }

  const secondaryEntries = seriesMaxEntries.filter(
    (entry) => entry.maxValue > 0 && overallMax / entry.maxValue >= SECONDARY_AXIS_RATIO_THRESHOLD
  );
  if (secondaryEntries.length === 0 || secondaryEntries.length === seriesMaxEntries.length) {
    return new Set<SpatialAnalysisHistorySeriesKey>();
  }

  return new Set(secondaryEntries.map((entry) => entry.key));
}

export function buildSpatialAnalysisHistoryChartModel(args: {
  readonly activeKeys: readonly SpatialAnalysisHistorySeriesKey[];
  readonly history: SpatialAnalysisHistoryModel;
}): SpatialAnalysisHistoryChartModel {
  const definitions = listSpatialAnalysisHistorySeries().filter((definition) =>
    args.activeKeys.includes(definition.key)
  );
  if (definitions.length === 0 || args.history.points.length === 0) {
    return buildEmptyChartModel(definitions);
  }

  const xPoints = buildChartPoints(args.history.points);
  const latestPoint = args.history.points.at(-1);
  if (typeof latestPoint === "undefined") {
    return buildEmptyChartModel(definitions);
  }

  const secondaryAxisKeys = determineSecondaryAxisKeys({
    definitions,
    history: args.history,
  });
  const primaryDefinitions = definitions.filter(
    (definition) => !secondaryAxisKeys.has(definition.key)
  );
  const secondaryDefinitions = definitions.filter((definition) =>
    secondaryAxisKeys.has(definition.key)
  );
  const yMaxPrimary = Math.max(
    0,
    ...args.history.points.flatMap((point) =>
      primaryDefinitions.map((definition) => readHistoryPointValue(point, definition.key))
    )
  );
  const yMaxSecondary =
    secondaryDefinitions.length === 0
      ? null
      : Math.max(
          0,
          ...args.history.points.flatMap((point) =>
            secondaryDefinitions.map((definition) => readHistoryPointValue(point, definition.key))
          )
        );

  return {
    lines: definitions.map((definition) => ({
      axis: secondaryAxisKeys.has(definition.key) ? "secondary" : "primary",
      color: definition.color,
      key: definition.key,
      label: definition.label,
      points: buildSeriesPointCoordinates({
        key: definition.key,
        points: args.history.points,
        xPoints,
        yMax: secondaryAxisKeys.has(definition.key) ? (yMaxSecondary ?? yMaxPrimary) : yMaxPrimary,
      }),
      path: buildLinePath({
        linePoints: buildSeriesPointCoordinates({
          key: definition.key,
          points: args.history.points,
          xPoints,
          yMax: secondaryAxisKeys.has(definition.key)
            ? (yMaxSecondary ?? yMaxPrimary)
            : yMaxPrimary,
        }),
      }),
      valueAtLatestPoint: readHistoryPointValue(latestPoint, definition.key),
    })),
    points: xPoints,
    ticks: [
      ...buildYTicks({ axis: "primary", yMax: yMaxPrimary }),
      ...(yMaxSecondary === null ? [] : buildYTicks({ axis: "secondary", yMax: yMaxSecondary })),
    ],
    yMaxPrimary,
    yMaxSecondary,
  };
}

export function listDefaultSpatialAnalysisHistorySeries(): readonly SpatialAnalysisHistorySeriesKey[] {
  return listSpatialAnalysisHistorySeries()
    .filter((definition) => definition.defaultVisible)
    .map((definition) => definition.key);
}
