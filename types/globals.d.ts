declare class Chart {
    constructor(context: CanvasRenderingContext2D, configuration: unknown);
    destroy(): void;
}

declare const QRCode: {
    new (container: HTMLElement, options: Record<string, unknown>): unknown;
    CorrectLevel: { L: unknown };
};

interface Material {
    id: string;
    name: string;
    hi_name?: string;
    desc: string;
    hi_desc?: string;
    otr: number;
    wvtr: number;
    tempRange: [number, number];
    greaseResistance: boolean;
    lowTempFlex: boolean;
    costPerM2: number;
    costScore?: number;
    recyclable: boolean;
    biodegradable: boolean;
    carbonFootprint: number;
    sustainabilityScore?: number;
    topsisScore?: number;
    topsisRank?: number;
    currentScore?: number;
    metrics?: Record<string, number>;
}

interface Commodity {
    name: string;
    category: string;
    moisture: number;
    fat: number;
    ph: number;
    aw: number;
    respiration: number;
    targetShelfLife: number;
    temp: number;
    rh: number;
    pkgArea: number | null;
    budget: number | null;
    packageWeight?: number;
}

interface RecommendationResult {
    recommendations: Material[];
    rejections: Record<string, string>;
    explanation: string;
    rejectionDetails?: Record<string, { rule: string; message: string }>;
    debug?: {
        requestId: string;
        input: Commodity;
        candidates: Array<Record<string, unknown>>;
        rejections: Record<string, { rule: string; message: string }>;
    };
}

interface SavedAnalysis {
    analysisId: string;
    batchId: string;
    timestamp: string;
    engineVersion: string;
}

interface ShelfLifeResult {
    predictedDays: number;
    unpackagedDays: number;
    modelNote?: string;
    timelineData: Array<{ day: number; quality: number }>;
}

interface MapResult {
    applicable: boolean;
    specs?: Record<string, string>;
    getHTML?: (lang?: string) => string;
}

interface Database {
    materials: Material[];
    presets: Record<string, Commodity & { hi_name: string }>;
    translations: Record<string, Record<string, string>>;
}

interface SustainabilityService {
    calculateScore(material: Material): number;
    getGrade(score: number): string;
    getGradeDesc(grade: string, lang?: string): string;
    getWidgetHTML(material: Material, lang?: string): string;
}

interface RecommendationEngine {
    recommend(commodity: Commodity, lang?: string): RecommendationResult;
}

interface ShelfLifeService {
    predict(commodity: Commodity, material: Material): ShelfLifeResult;
}

interface MapService {
    analyze(commodity: Commodity, material: Material): MapResult;
}

interface ChartsService {
    radarInstance: unknown;
    shelfLifeInstance: unknown;
    renderRadar(canvasId: string, materials: Material[]): void;
    renderShelfLife(canvasId: string, timelineData: ShelfLifeResult['timelineData'], unpackagedDays: number): void;
}

interface QRService {
    generate(containerId: string, data: Record<string, unknown>, lang?: string): void;
}

interface ExportService {
    print(): void;
}

interface AppController {
    currentCommodity: Commodity | null;
    currentResults: (RecommendationResult & { shelfLifeRes: ShelfLifeResult; mapRes: MapResult; analysisId?: string; batchId?: string }) | null;
    lang: string;
    mode: string;
    init(): void;
    toggleLang(): void;
    toggleMode(): void;
    applyTranslations(): void;
    navigate(sectionId: string): void;
    loadPreset(presetKey: string): void;
    runAnalysis(event: Event): Promise<void>;
    requestRecommendation(commodity: Commodity): Promise<RecommendationResult>;
        saveAnalysis(): Promise<SavedAnalysis | null>;
    renderResults(): void;
    showQR(): void;
    closeQR(): void;
    printReport(): void;
}