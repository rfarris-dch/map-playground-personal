import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { readFile, utils } from "xlsx";
import { ensureDirectory, writeJsonAtomic, writeTextAtomic } from "./atomic-file-store";
import { runBufferedCommand } from "./command-runner";

const CSV_LINE_SPLIT_REGEX = /\r?\n/u;
const COUNTY_OR_PARISH_SUFFIX_REGEX = /county|parish/iu;
const DIACRITIC_MARK_REGEX = /[\u0300-\u036f]/gu;
const EIA_861_PAGE_URL = "https://www.eia.gov/electricity/data/eia861/";
const EIA_861_ZIP_BASE_URL = "https://www.eia.gov/electricity/data/eia861/zip/";
const EIA_861_ZIP_URL_PATTERN = /href="([^"]*\/zip\/f861(\d{4})\.zip)"/giu;
const NWS_ZONE_COUNTY_PAGE_URL = "https://www.weather.gov/gis/ZoneCounty";
const NWS_ZONE_COUNTY_DBX_FILE_NAME_PATTERN = /^(bp(\d{2})([a-z]{2})(\d{2})\.dbx)$/iu;
const NWS_ZONE_COUNTY_DBX_URL_PATTERN =
  /href="([^"]*\/source\/gis\/Shapefiles\/County\/(bp(\d{2})([a-z]{2})(\d{2})\.dbx))"/giu;
const CENSUS_ZCTA_COUNTY_RELATION_URL =
  "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt";
const CENSUS_GAZETTEER_PAGE_URL =
  "https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html";
const CENSUS_GEOGRAPHY_CHANGES_SOURCE_PAGE_URL =
  "https://www.census.gov/programs-surveys/acs/technical-documentation/table-and-geography-changes/2019/geography-changes.html";
const CENSUS_COUSUB_GAZETTEER_URL_PATTERN = /href="([^"]*?(\d{4})_Gaz_cousubs_national\.zip)"/giu;
const CENSUS_PLACE_GAZETTEER_URL_PATTERN = /href="([^"]*?(\d{4})_Gaz_place_national\.zip)"/giu;
const CAISO_PUBLIC_QUEUE_REPORT_PAGE_URL = "https://www.caiso.com/library/public-queue-report";
const CAISO_PUBLIC_QUEUE_WORKBOOK_URL_PATTERN = /href="([^"]*publicqueuereport\.xlsx[^"]*)"/iu;
const CAISO_QUEUE_REPORT_RUN_DATE_PATTERN = /Report Run Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/u;
const CAISO_OASIS_SINGLE_ZIP_URL = "https://oasis.caiso.com/oasisapi/SingleZip";
const COMMUNITY_SOLAR_POLICY_SUBMISSION_URL = "https://data.nlr.gov/submissions/249";
const COMMUNITY_SOLAR_POLICY_FILE_URL_PATTERN =
  /href="(https:\/\/data\.nlr\.gov\/system\/files\/249\/[^"]+\.xlsx)"/giu;
const COMMUNITY_SOLAR_POLICY_LAST_UPDATED_PATTERN =
  /Last updated:\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\./u;
const NPMS_ACTIVE_PIPE_COUNTY_MILEAGE_URL =
  "https://www.npms.phmsa.dot.gov/Documents/NPMS_Active_Pipe_County_Mileage.xlsx";
const NPMS_PUBLIC_PORTAL_URL = "https://www.npms.phmsa.dot.gov/GeneralPublic.aspx";
const COUNTY_NAME_CITY_OF_PREFIX_REGEX = /^city of\s+/iu;
const COUNTY_NAME_CITY_SUFFIX_REGEX = /\s+city$/iu;
const COUNTY_NAME_SPLIT_REGEX = /\s*(?:,|\/|&|;|\band\b)\s*/iu;
const HTML_TABLE_BODY_PATTERN = /<tbody>([\s\S]*?)<\/tbody>/iu;
const HTML_TABLE_HEADER_PATTERN = /<thead>[\s\S]*?<tr[^>]*>([\s\S]*?)<\/tr>[\s\S]*?<\/thead>/iu;
const HTML_TITLE_ATTRIBUTE_PATTERN = /title=['"]([^'"]+)['"]/iu;
const ERCOT_PERIOD_RANGE_REGEX =
  /([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\s+to\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/u;
const ERCOT_NUMERIC_DATE_PATTERN = /^\d{8}$/u;
const ERCOT_US_DATE_PATTERN = /^\d{1,2}\/\d{1,2}\/\d{4}$/u;
const EXTERNAL_FETCH_RETRY_ATTEMPTS = 3;
const EXTERNAL_FETCH_RETRY_BASE_DELAY_MS = 1000;
const EXTERNAL_FETCH_TIMEOUT_MS = 120_000;
const FIBERLOCATOR_COUNTY_QUERY_CONCURRENCY = 16;
const GENERIC_HEADER_LABELS = new Set(["Utility Characteristics"]);
const ISO_TIMESTAMP_MILLISECONDS_SUFFIX_REGEX = /\.\d{3}Z$/u;
const PJM_PROJECT_NODE_REGEX = /<Project\b[^>]*>([\s\S]*?)<\/Project>/gu;
const PLACE_LOOKUP_CITY_OF_PREFIX_REGEX = /^city of /u;
const PLACE_LOOKUP_SUFFIX_REGEX = /\b(cdp|city|town|village|borough|municipality)\b$/u;
const SPP_LOCATION_AND_SPLIT_REGEX = /\band\b/giu;
const US_MONTH_YEAR_PATTERN = /^(\d{1,2})[-/](\d{2,4})$/u;
const UTF8_BOM_REGEX = /^\uFEFF/u;
const VOLTAGE_KV_REGEX = /(\d{2,4})\s*k?v/iu;
const ZIP_TEXT_CAPTURE_MAX_BYTES = 64_000_000;
const ISO_OPERATORS = [
  {
    header: "Operating in these RTOs__CAISO",
    operator: "CAISO",
  },
  {
    header: "ERCOT",
    operator: "ERCOT",
  },
  {
    header: "PJM",
    operator: "PJM",
  },
  {
    header: "NYISO",
    operator: "NYISO",
  },
  {
    header: "SPP",
    operator: "SPP",
  },
  {
    header: "MISO",
    operator: "MISO",
  },
  {
    header: "ISONE",
    operator: "ISO-NE",
  },
];
const BALANCING_AUTHORITY_ORGANIZED_OPERATOR_MAP = new Map([
  ["CISO", "CAISO"],
  ["ERCO", "ERCOT"],
  ["ISNE", "ISO-NE"],
  ["MISO", "MISO"],
  ["NYIS", "NYISO"],
  ["PJM", "PJM"],
  ["SWPP", "SPP"],
]);
const ORGANIZED_OPERATOR_BALANCING_AUTHORITY_CODE_MAP = new Map([
  ["CAISO", "CISO"],
  ["ERCOT", "ERCO"],
  ["ISO-NE", "ISNE"],
  ["MISO", "MISO"],
  ["NYISO", "NYIS"],
  ["PJM", "PJM"],
  ["SPP", "SWPP"],
]);
const FULL_STATE_ORGANIZED_OPERATOR_MAP = new Map([
  ["CT", "ISO-NE"],
  ["DC", "PJM"],
  ["DE", "PJM"],
  ["MA", "ISO-NE"],
  ["MD", "PJM"],
  ["ME", "ISO-NE"],
  ["NH", "ISO-NE"],
  ["NJ", "PJM"],
  ["NY", "NYISO"],
  ["RI", "ISO-NE"],
  ["VT", "ISO-NE"],
]);
const STATE_ORGANIZED_OPERATOR_CANDIDATES = new Map(
  Object.entries({
    AR: ["MISO", "SPP"],
    CA: ["CAISO"],
    CT: ["ISO-NE"],
    DC: ["PJM"],
    DE: ["PJM"],
    IA: ["MISO"],
    IL: ["MISO", "PJM"],
    IN: ["MISO", "PJM"],
    KS: ["SPP"],
    KY: ["MISO", "PJM"],
    LA: ["MISO", "SPP"],
    MA: ["ISO-NE"],
    MD: ["PJM"],
    ME: ["ISO-NE"],
    MI: ["MISO", "PJM"],
    MN: ["MISO"],
    MO: ["MISO", "SPP"],
    MS: ["MISO", "SPP"],
    MT: ["MISO"],
    NC: ["PJM"],
    ND: ["MISO"],
    NE: ["SPP"],
    NH: ["ISO-NE"],
    NJ: ["PJM"],
    NM: ["SPP"],
    NY: ["NYISO"],
    OH: ["PJM"],
    OK: ["SPP"],
    PA: ["PJM"],
    RI: ["ISO-NE"],
    SD: ["MISO", "SPP"],
    TN: ["PJM"],
    TX: ["ERCOT", "MISO", "SPP"],
    VA: ["PJM"],
    VT: ["ISO-NE"],
    WI: ["MISO"],
    WV: ["PJM"],
  }).map((entry) => {
    const [stateAbbrev, operators] = entry;
    return [stateAbbrev, new Set(operators)];
  })
);
const SERVICE_TERRITORY_SOURCE_PAGE_URL = EIA_861_PAGE_URL;
const SPP_QUEUE_CSV_URL = "https://opsportal.spp.org/Studies/GenerateActiveCSV";
const SPP_QUEUE_SOURCE_PAGE_URL = "https://opsportal.spp.org/Studies/GenerateActiveCSV";
const SPP_RTBM_FEATURE_SERVICE_URL =
  "https://pricecontourmap.spp.org/arcgis/rest/services/MarketMaps/RTBM_FeatureData/MapServer";
const SPP_RTBM_SOURCE_PAGE_URL =
  "https://pricecontourmap.spp.org/arcgis/rest/services/MarketMaps/RTBM_FeatureData/MapServer";
const SPP_SETTLEMENT_LOCATION_SOURCE_PAGE_URL = "https://portal.spp.org/pages/rtbm-lmp-by-location";
const PJM_QUEUE_XML_URL =
  "https://www.pjm.com/pjmfiles/media/planning/queues-data/PlanningQueues.xml";
const PJM_QUEUE_SOURCE_PAGE_URL =
  "https://www.pjm.com/planning/services-requests/interconnection-queues";
const PJM_CONGESTION_SOURCE_PAGE_URL =
  "https://www.pjm.com/markets-and-operations/etools/data-miner-2";
const PJM_SYSTEM_MAP_SOURCE_URL = "https://gis.pjm.com/esm/default.html";
const PJM_API_BASE_URL = "https://api.pjm.com/api/v1";
const PJM_API_SUBSCRIPTION_KEY = "624c152b81f2406cb9f36aa0891b644c";
const MISO_QUEUE_JSON_URL = "https://www.misoenergy.org/api/giqueue/getprojects";
const MISO_QUEUE_SOURCE_PAGE_URL =
  "https://www.misoenergy.org/planning/resource-utilization/GI_Queue/";
const MISO_PUBLIC_API_BASE_URL = "https://public-api.misoenergy.org/api";
const MISO_CONGESTION_SOURCE_PAGE_URL =
  "https://www.misoenergy.org/markets-and-operations/real-time--market-data/operations-displays";
const MISO_LRZ_SOURCE_URL =
  "https://docs.misoenergy.org/miso12-legalcontent/Attachment_VV_-_MAP_of_Local_Resource_Zone_Boundaries.pdf";
const NYISO_QUEUE_WORKBOOK_URL_PATTERN =
  /<a class="custom" href="([^"]+)"[^>]*>\s*Interconnection Queue\s*<\/a>/iu;
const NYISO_QUEUE_SOURCE_PAGE_URL = "https://www.nyiso.com/interconnections";
const NYISO_PUBLIC_BASE_URL = "https://mis.nyiso.com/public";
const NYISO_REALTIME_ZONAL_LBMP_LIST_URL = `${NYISO_PUBLIC_BASE_URL}/P-24Alist.htm`;
const NYISO_LIMITING_CONSTRAINTS_LIST_URL = `${NYISO_PUBLIC_BASE_URL}/P-33list.htm`;
const NYISO_CONGESTION_SOURCE_PAGE_URL = NYISO_PUBLIC_BASE_URL;
const NYISO_CSV_LINK_PATTERN = /<A[^>]+HREF="([^"]+\.csv)"[^>]*>/giu;
const NYISO_DATED_CSV_PATH_PATTERN = /\/\d{8}[^/"]+\.csv$/u;
const NYISO_COUNTY_SUFFIX_STATE_REGEX = /^(.+)-([A-Z]{2})$/u;
const NYISO_COUNTY_ALIAS_MAP = new Map([
  ["ALLAGANY", "Allegany"],
  ["ALLEGHANY", "Allegany"],
  ["BROOKLYN", "Kings"],
  ["BROOKLYN COUNTY", "Kings"],
  ["CAHATAUQUA", "Chautauqua"],
  ["CHAATAUQUA", "Chautauqua"],
  ["CHATAUQUA", "Chautauqua"],
  ["COURTLAND", "Cortland"],
  ["COURTLAND COUNTY", "Cortland"],
  ["KINGS COUNTY", "Kings"],
  ["MANHATTAN", "New York"],
  ["NASSU", "Nassau"],
  ["NIAGRA", "Niagara"],
  ["ONIEDA", "Oneida"],
  ["OSTEGO", "Otsego"],
  ["RICHMOND-NJ", "Richmond"],
  ["STATEN ISLAND", "Richmond"],
  ["ST. LAWRENCE", "St. Lawrence"],
  ["ST; LAWRENCE", "St. Lawrence"],
  ["THE BRONX", "Bronx"],
]);
const ERCOT_GIS_REPORT_TYPE_ID = 15_933;
const ERCOT_SETTLEMENT_POINT_PRICE_REPORT_TYPE_ID = 12_301;
const ERCOT_SCED_CONSTRAINT_REPORT_TYPE_ID = 12_302;
const ERCOT_SCED_SYSTEM_LAMBDA_REPORT_TYPE_ID = 13_114;
const ERCOT_MIS_LIST_URL = "https://www.ercot.com/misapp/servlets/IceDocListJsonWS";
const ERCOT_MIS_DOWNLOAD_URL = "https://www.ercot.com/misdownload/servlets/mirDownload";
const ERCOT_APPENDIX_D_PROFILE_DECISION_TREE_URL =
  "https://www.ercot.com/files/docs/2024/04/30/Appendix_D_Profile_Decision_Tree_050124.xlsx";
const ERCOT_APPENDIX_D_DATE_PATTERN = /_(\d{2})(\d{2})(\d{2})\.xlsx$/u;
const ERCOT_QUEUE_SOURCE_PAGE_URL =
  "https://www.ercot.com/mp/data-products/data-product-details?id=pg7-200-er";
const ERCOT_CONGESTION_SOURCE_PAGE_URL =
  "https://www.ercot.com/mp/data-products/data-product-details?id=NP6-905-ER";
const TRANSMISSION_SERVICE_URL =
  "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/US_Electric_Power_Transmission_Lines/FeatureServer";
const TRANSMISSION_SOURCE_PAGE_URL =
  "https://www.arcgis.com/home/item.html?id=d4090758322c4d32a4cd002ffaa0aa12";
const ISO_NE_QUEUE_SOURCE_PAGE_URL = "https://irtt.iso-ne.com/reports/external";
const ISO_NE_QUEUE_TABLE_ID = "publicqueue";
const ISO_NE_QUEUE_AS_OF_DATE_PATTERN = /As of:\s*(\d{1,2}\/\d{1,2}\/\d{4})/u;
const ISO_NE_REAL_TIME_LMP_SOURCE_PAGE_URL =
  "https://www.iso-ne.com/isoexpress/web/reports/pricing/-/tree/lmps-rt-hourly-final";
const ISO_NE_REAL_TIME_CONSTRAINT_SOURCE_PAGE_URL =
  "https://www.iso-ne.com/isoexpress/web/reports/grid/-/tree/constraint-rt-fifteen-minute-prelim";
const ISO_NE_RT_LMP_CSV_URL_PATTERN =
  /\/static-transform\/csv\/histRpts\/rt-lmp\/lmp_rt_final_(\d{8})\.csv/gu;
const _TRANSMISSION_THRESHOLD_KV = [69, 138, 230, 345, 500, 765];
const UTILITY_DATA_SOURCE_PAGE_URL = EIA_861_PAGE_URL;
const UNKNOWN_QUEUE_STATUSES = new Set(["n/a", "none", "unknown"]);
const NWS_FILE_MONTH_ABBREV_MAP = new Map([
  ["ap", 4],
  ["au", 8],
  ["de", 12],
  ["fe", 2],
  ["ja", 1],
  ["jl", 7],
  ["jn", 6],
  ["mr", 3],
  ["my", 5],
  ["no", 11],
  ["oc", 10],
  ["se", 9],
]);
const bunRuntime = globalThis.Bun;

if (typeof bunRuntime === "undefined") {
  throw new Error("Bun runtime is required for county-power public-US extraction");
}

function buildSppLocationOverrideKey(stateAbbrev, locationName) {
  return `${stateAbbrev}|${collapseWhitespace(locationName.toLowerCase())}`;
}
function buildCountyAliasKey(stateAbbrev, countyName) {
  return `${stateAbbrev}|${normalizeCountyNameFullKey(countyName)}`;
}
const SPP_QUEUE_LOCATION_OVERRIDES = new Map([
  [
    buildSppLocationOverrideKey("OK", "Goultry"),
    {
      countyName: "Alfalfa County",
      stateAbbrev: "OK",
    },
  ],
  [
    buildSppLocationOverrideKey("MO", "Indepedence"),
    {
      countyName: "Jackson County",
      stateAbbrev: "MO",
    },
  ],
  [
    buildSppLocationOverrideKey("KS", "Lavenworth"),
    {
      countyName: "Leavenworth County",
      stateAbbrev: "KS",
    },
  ],
  [
    buildSppLocationOverrideKey("OK", "La Flore"),
    {
      countyName: "Le Flore County",
      stateAbbrev: "OK",
    },
  ],
  [
    buildSppLocationOverrideKey("OK", "Cluster"),
    {
      countyName: "Custer County",
      stateAbbrev: "OK",
    },
  ],
  [
    buildSppLocationOverrideKey("KS", "Linn KS and Bates MO"),
    {
      countyName: "Linn County",
      stateAbbrev: "KS",
    },
  ],
  [
    buildSppLocationOverrideKey("SD", "Wessington/Hand Counties"),
    {
      countyName: "Hand County",
      stateAbbrev: "SD",
    },
  ],
  [
    buildSppLocationOverrideKey("OK", "Bourbon and Crawford Counties"),
    {
      countyName: "Bourbon County",
      stateAbbrev: "KS",
    },
  ],
  [
    buildSppLocationOverrideKey("KS", "Dickenson / Marion Counties"),
    {
      countyName: "Dickinson County",
      stateAbbrev: "KS",
    },
  ],
  [
    buildSppLocationOverrideKey("NE", "North Platte - Lexington"),
    {
      countyName: "Lincoln County",
      stateAbbrev: "NE",
    },
  ],
  [
    buildSppLocationOverrideKey("LA", "Caddo Prsh."),
    {
      countyName: "Caddo Parish",
      stateAbbrev: "LA",
    },
  ],
  [
    buildSppLocationOverrideKey("NE", "Brownsville"),
    {
      countyName: "Nemaha County",
      stateAbbrev: "NE",
    },
  ],
  [
    buildSppLocationOverrideKey("NE", "Columbus"),
    {
      countyName: "Platte County",
      stateAbbrev: "NE",
    },
  ],
  [
    buildSppLocationOverrideKey("KS", "Riverton SE Cherokee Cnty"),
    {
      countyName: "Cherokee County",
      stateAbbrev: "KS",
    },
  ],
  [
    buildSppLocationOverrideKey("KS", "Salina NC Ellsworth Cnty"),
    {
      countyName: "Ellsworth County",
      stateAbbrev: "KS",
    },
  ],
  [
    buildSppLocationOverrideKey("KS", "Beaumont SE Butler Cnty"),
    {
      countyName: "Butler County",
      stateAbbrev: "KS",
    },
  ],
  [
    buildSppLocationOverrideKey("MO", "LaRussell Energy Ctr."),
    {
      countyName: "Jasper County",
      stateAbbrev: "MO",
    },
  ],
  [
    buildSppLocationOverrideKey("MO", "LaRussell Energy Center"),
    {
      countyName: "Jasper County",
      stateAbbrev: "MO",
    },
  ],
]);
const COUNTY_FIPS_ALIAS_RECORDS = [
  {
    aliasCountyFips: "02063",
    aliasKind: "county_equivalent_split",
    canonicalCountyFips: "02261",
  },
  {
    aliasCountyFips: "02066",
    aliasKind: "county_equivalent_split",
    canonicalCountyFips: "02261",
  },
  {
    aliasCountyFips: "02158",
    aliasKind: "county_equivalent_rename",
    canonicalCountyFips: "02270",
  },
  {
    aliasCountyFips: "46102",
    aliasKind: "county_equivalent_rename",
    canonicalCountyFips: "46113",
  },
  {
    aliasCountyFips: "51019",
    aliasKind: "county_equivalent_merge",
    canonicalCountyFips: "51515",
  },
];
const COUNTY_NAME_STATE_ALIAS_MAP = new Map([
  [buildCountyAliasKey("AK", "Kusilvak"), ["Wade Hampton"]],
  [
    buildCountyAliasKey("AK", "Prince of Wales Ketchikan"),
    ["Ketchikan Gateway Borough", "Prince of Wales-Hyder Census Area"],
  ],
  [
    buildCountyAliasKey("AK", "Skagway Hoonah Angoon"),
    ["Hoonah-Angoon Census Area", "Skagway Municipality"],
  ],
  [buildCountyAliasKey("AK", "Valdez Cordova"), ["Valdez-Cordova"]],
  [
    buildCountyAliasKey("AK", "Wrangell Petersburg"),
    ["Petersburg Borough", "Wrangell City and Borough"],
  ],
  [buildCountyAliasKey("IL", "DeWitt"), ["De Witt County"]],
  [buildCountyAliasKey("IL", "LaSalle"), ["LaSalle County"]],
  [buildCountyAliasKey("IL", "McLean"), ["McLean County"]],
  [buildCountyAliasKey("IL", "Mclean"), ["McLean County"]],
  [buildCountyAliasKey("LA", "De Soto"), ["De Soto Parish"]],
  [buildCountyAliasKey("LA", "DeSoto"), ["De Soto Parish"]],
  [buildCountyAliasKey("LA", "Jefferson Davies"), ["Jeff Davis Parish"]],
  [buildCountyAliasKey("LA", "La Salle"), ["LaSalle Parish"]],
  [buildCountyAliasKey("LA", "Lasalle"), ["LaSalle Parish"]],
  [buildCountyAliasKey("MD", "Baltimore"), ["Baltimore County"]],
  [buildCountyAliasKey("MN", "Lake of The Woods"), ["Lake of the Woods County"]],
  [buildCountyAliasKey("MO", "St Louis"), ["St. Louis County"]],
  [buildCountyAliasKey("NM", "Dona Ana"), ["Doña Ana County"]],
  [buildCountyAliasKey("NC", "Northhampton"), ["Northampton County"]],
  [buildCountyAliasKey("NC", "Tyrell"), ["Tyrrell County"]],
  [buildCountyAliasKey("NY", "Allagany"), ["Allegany County"]],
  [buildCountyAliasKey("NY", "Alleghany"), ["Allegany County"]],
  [buildCountyAliasKey("NY", "Brooklyn"), ["Kings County"]],
  [buildCountyAliasKey("NY", "Brooklyn County"), ["Kings County"]],
  [buildCountyAliasKey("NY", "Cahatauqua"), ["Chautauqua County"]],
  [buildCountyAliasKey("NY", "Chatauqua"), ["Chautauqua County"]],
  [buildCountyAliasKey("NY", "Courtland"), ["Cortland County"]],
  [buildCountyAliasKey("NY", "Manhattan"), ["New York County"]],
  [buildCountyAliasKey("NY", "Nassua"), ["Nassau County"]],
  [buildCountyAliasKey("NY", "Niagra"), ["Niagara County"]],
  [buildCountyAliasKey("NY", "Onieda"), ["Oneida County"]],
  [buildCountyAliasKey("NY", "Ostego"), ["Otsego County"]],
  [buildCountyAliasKey("NY", "Queens County"), ["Queens County"]],
  [buildCountyAliasKey("NY", "St Lawrence"), ["St. Lawrence County"]],
  [buildCountyAliasKey("NY", "St; Lawrence"), ["St. Lawrence County"]],
  [buildCountyAliasKey("NY", "The Bronx"), ["Bronx County"]],
  [buildCountyAliasKey("PA", "Mc Kean"), ["McKean County"]],
  [buildCountyAliasKey("SD", "Codington"), ["Codington County"]],
  [buildCountyAliasKey("SD", "Oglala Lakota"), ["Shannon"]],
  [buildCountyAliasKey("VA", "Accomack"), ["Accomack County"]],
  [buildCountyAliasKey("VA", "Bedford"), ["Bedford County"]],
  [buildCountyAliasKey("VA", "Fairfax"), ["Fairfax County"]],
  [buildCountyAliasKey("VA", "Franklin"), ["Franklin County"]],
  [buildCountyAliasKey("VA", "Richmond"), ["Richmond County"]],
  [buildCountyAliasKey("VA", "Roanoke"), ["Roanoke County"]],
  [buildCountyAliasKey("WV", "Raliegh"), ["Raleigh County"]],
  [buildCountyAliasKey("IN", "LeGrange"), ["LaGrange County"]],
  [buildCountyAliasKey("IN", "Tippecance"), ["Tippecanoe County"]],
  [buildCountyAliasKey("KY", "Keaton"), ["Kenton County"]],
  [buildCountyAliasKey("MI", "Shiawasse"), ["Shiawassee County"]],
  [buildCountyAliasKey("NV", "Church"), ["Churchill County"]],
  [buildCountyAliasKey("CA", "L.A"), ["Los Angeles County"]],
  [buildCountyAliasKey("CA", "L A"), ["Los Angeles County"]],
  [buildCountyAliasKey("AZ", "Mojave"), ["Mohave County"]],
  [buildCountyAliasKey("CA", "San Bernadino"), ["San Bernardino County"]],
  [buildCountyAliasKey("CA", "San Clara"), ["Santa Clara County"]],
  [buildCountyAliasKey("CA", "Los Angeles"), ["Los Angeles County"]],
]);
const COUNTY_LOAD_ZONE_OVERRIDE_MAP = new Map([
  [
    "CAISO",
    new Map([
      ["06003", "PGAE"],
      ["06009", "PGAE"],
      ["06049", "PGAE"],
      ["06057", "PGAE"],
      ["06067", "PGAE"],
      ["06087", "PGAE"],
      ["06091", "PGAE"],
      ["06093", "PGAE"],
      ["06105", "PGAE"],
    ]),
  ],
  [
    "ISO-NE",
    new Map([
      ["23021", "ME"],
      ["23027", "ME"],
      ["25019", "SEMA"],
      ["33003", "NH"],
      ["44001", "RI"],
      ["50013", "VT"],
      ["50015", "VT"],
    ]),
  ],
  [
    "NYISO",
    new Map([
      ["36003", "A"],
      ["36001", "F"],
      ["36027", "G"],
      ["36033", "D"],
      ["36079", "G"],
      ["36083", "F"],
      ["36093", "F"],
    ]),
  ],
]);
const PJM_UTILITY_LOAD_ZONE_MAP = new Map([
  ["Appalachian Power Co", "AEP"],
  ["Atlantic City Electric Co", "AECO"],
  ["Baltimore Gas & Electric Co", "BGE"],
  ["Cleveland Electric Illum Co", "ATSI"],
  ["Commonwealth Edison Co", "COMED"],
  ["Dayton Power & Light Co", "DAY"],
  ["Delmarva Power", "DPL"],
  ["Duke Energy Kentucky", "DEOK"],
  ["Duke Energy Ohio Inc", "DEOK"],
  ["FirstEnergy Pennsylvania Electric Co", "PENELEC"],
  ["Indiana Michigan Power Co", "AEP"],
  ["Jersey Central Power & Lt Co", "JCPL"],
  ["Kentucky Power Co", "AEP"],
  ["Kentucky Utilities Co", "LGEE"],
  ["Louisville Gas & Electric Co", "LGEE"],
  ["Monongahela Power Co", "APS"],
  ["Ohio Edison Co", "ATSI"],
  ["Ohio Power Co", "AEP"],
  ["PECO Energy Co", "PECO"],
  ["PPL Electric Utilities Corp", "PPL"],
  ["Potomac Electric Power Co", "PEPCO"],
  ["Public Service Elec & Gas Co", "PSEG"],
  ["The Potomac Edison Company", "APS"],
  ["The Toledo Edison Co", "ATSI"],
  ["Virginia Electric & Power Co", "DOM"],
  ["Wheeling Power Co", "AEP"],
]);
const MISO_LOCAL_RESOURCE_ZONE_BY_STATE = new Map([
  ["AR", "LRZ 8"],
  ["IA", "LRZ 3"],
  ["IL", "LRZ 4"],
  ["IN", "LRZ 6"],
  ["KY", "LRZ 6"],
  ["LA", "LRZ 9"],
  ["MI", "LRZ 7"],
  ["MN", "LRZ 1"],
  ["MO", "LRZ 5"],
  ["MS", "LRZ 10"],
  ["ND", "LRZ 1"],
  ["SD", "LRZ 3"],
  ["TX", "LRZ 9"],
  ["WI", "LRZ 2"],
]);
const MISO_TRANSMISSION_PRICING_ZONE_TO_LRZ = new Map([
  ["ATC", "LRZ 2"],
  ["AMIL", "LRZ 4"],
  ["AMMO", "LRZ 5"],
  ["BREC", "LRZ 6"],
  ["CLCE", "LRZ 9"],
  ["CWLD", "LRZ 5"],
  ["CWLP", "LRZ 4"],
  ["DEI", "LRZ 6"],
  ["DPC", "LRZ 1"],
  ["EATO", "LRZ 8"],
  ["ELTO", "LRZ 9"],
  ["EMTO", "LRZ 10"],
  ["ENTO", "LRZ 9"],
  ["ETTO", "LRZ 9"],
  ["GRE", "LRZ 1"],
  ["HE", "LRZ 6"],
  ["IPL", "LRZ 6"],
  ["ITC", "LRZ 7"],
  ["ITCM", "LRZ 3"],
  ["LAFA", "LRZ 9"],
  ["MDU", "LRZ 1"],
  ["MEC", "LRZ 3"],
  ["METC", "LRZ 7"],
  ["MP", "LRZ 1"],
  ["MPW", "LRZ 3"],
  ["NIPS", "LRZ 6"],
  ["NSP", "LRZ 1"],
  ["OTP", "LRZ 1"],
  ["SIPC", "LRZ 4"],
  ["SME", "LRZ 10"],
  ["SMP", "LRZ 1"],
  ["VECT", "LRZ 6"],
]);
function collapseWhitespace(value) {
  return value.replace(/\s+/gu, " ").trim();
}
function stripDiacritics(value) {
  return value.normalize("NFKD").replaceAll(DIACRITIC_MARK_REGEX, "");
}
function normalizeHeaderLabel(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = collapseWhitespace(value);
  return normalized.length > 0 ? normalized : null;
}
function isPlainRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function normalizeDisplayText(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = collapseWhitespace(value);
  if (normalized.length === 0 || normalized === ".") {
    return null;
  }
  return normalized;
}
function normalizeBalancingAuthorityCode(value) {
  const normalized = normalizeDisplayText(value)?.toUpperCase() ?? null;
  if (normalized === null || normalized === "NA" || normalized === "N/A" || normalized === "NONE") {
    return null;
  }
  return normalized;
}
function normalizeMarker(value) {
  return normalizeDisplayText(value)?.toUpperCase() === "Y";
}
function normalizeUsYear(year) {
  if (!Number.isInteger(year)) {
    return null;
  }
  if (year >= 100) {
    return year;
  }
  if (year >= 70) {
    return 1900 + year;
  }
  return 2000 + year;
}
function parseOptionalNumber(value) {
  const normalized = normalizeDisplayText(value);
  if (normalized === null) {
    return null;
  }
  const upperValue = normalized.toUpperCase();
  if (
    upperValue === "N/A" ||
    upperValue === "NA" ||
    upperValue === "NONE" ||
    upperValue === "N/R" ||
    upperValue === "TBA" ||
    upperValue === "TBD" ||
    upperValue === "UNKNOWN" ||
    upperValue === "-" ||
    upperValue === "--"
  ) {
    return null;
  }
  const parsed = Number(normalized.replaceAll(",", ""));
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected numeric workbook value, received "${normalized}"`);
  }
  return parsed;
}
function parseOptionalNumericLike(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  return parseOptionalNumber(value);
}
function parseOptionalUsDate(value) {
  const normalized = normalizeDisplayText(value);
  if (normalized === null) {
    return null;
  }
  const parts = normalized.split("/");
  if (parts.length !== 3) {
    return null;
  }
  const [monthRaw, dayRaw, yearRaw] = parts;
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const year = normalizeUsYear(Number(yearRaw));
  if (
    !(Number.isInteger(month) && Number.isInteger(day) && Number.isInteger(year)) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function parseOptionalUsMonthYearDate(value) {
  const normalized = normalizeDisplayText(value);
  if (normalized === null) {
    return null;
  }
  const match = normalized.match(US_MONTH_YEAR_PATTERN);
  if (match === null) {
    return null;
  }
  const month = Number(match[1] ?? "");
  const year = normalizeUsYear(Number(match[2] ?? ""));
  if (!(Number.isInteger(month) && Number.isInteger(year)) || month < 1 || month > 12) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
}
function parseOptionalUsLikeDate(value) {
  return parseOptionalUsDate(value) ?? parseOptionalUsMonthYearDate(value);
}
function differenceInDays(fromDate, toDate) {
  const fromValue = Date.parse(`${fromDate}T00:00:00Z`);
  const toValue = Date.parse(`${toDate}T00:00:00Z`);
  return Math.max(0, Math.floor((toValue - fromValue) / 86_400_000));
}
function shiftIsoDate(isoDate, dayDelta) {
  const parsed = Date.parse(`${isoDate}T00:00:00Z`);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ISO date "${isoDate}"`);
  }
  return toIsoDate(new Date(parsed + dayDelta * 86_400_000));
}
function compactIsoDate(isoDate) {
  return isoDate.replaceAll("-", "");
}
function stripUtf8Bom(value) {
  return value.replace(UTF8_BOM_REGEX, "");
}
function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let insideQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      const nextCharacter = line[index + 1];
      if (insideQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
        continue;
      }
      insideQuotes = !insideQuotes;
      continue;
    }
    if (character === "," && !insideQuotes) {
      fields.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  fields.push(current);
  return fields;
}
function parseCsvRecords(content) {
  const lines = content
    .split(CSV_LINE_SPLIT_REGEX)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
  if (lines.length < 2) {
    return [];
  }
  return parseCsvRecordsWithHeaderLine(content, 1);
}
function parseCsvRecordsWithHeaderLine(content, headerLineIndex) {
  const lines = content
    .split(CSV_LINE_SPLIT_REGEX)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
  if (lines.length <= headerLineIndex) {
    return [];
  }
  const header = parseCsvLine(lines[headerLineIndex] ?? "").map((value, index) =>
    collapseWhitespace(index === 0 ? stripUtf8Bom(value) : value)
  );
  const records = [];
  for (const line of lines.slice(headerLineIndex + 1)) {
    const fields = parseCsvLine(line);
    const record = {};
    for (let index = 0; index < header.length; index += 1) {
      const key = header[index];
      if (typeof key !== "string" || key.length === 0) {
        continue;
      }
      record[key] = normalizeDisplayText(fields[index]);
    }
    records.push(record);
  }
  return records;
}
function parsePipeDelimitedRecords(content) {
  const lines = content
    .split(CSV_LINE_SPLIT_REGEX)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
  if (lines.length < 2) {
    return [];
  }
  const header = (lines[0] ?? "")
    .split("|")
    .map((value, index) => collapseWhitespace(index === 0 ? stripUtf8Bom(value) : value));
  const records = [];
  for (const line of lines.slice(1)) {
    const fields = line.split("|");
    const record = {};
    for (let index = 0; index < header.length; index += 1) {
      const key = header[index];
      if (typeof key !== "string" || key.length === 0) {
        continue;
      }
      record[key] = normalizeDisplayText(fields[index]);
    }
    records.push(record);
  }
  return records;
}
function parseNwsZoneCountyRecords(content) {
  return content
    .split(CSV_LINE_SPLIT_REGEX)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .map((line) => {
      const fields = line.split("|");
      return {
        countyFips: normalizeDisplayText(fields[6]),
        countyName: normalizeDisplayText(fields[5]),
        stateAbbrev: normalizeUsStateAbbrev(fields[0]),
        stateZone: normalizeDisplayText(fields[4]),
        zoneCode: normalizeDisplayText(fields[1]),
        zoneName: normalizeDisplayText(fields[3]),
      };
    });
}
function normalizeQueueStatus(value, expectedOperationDate) {
  const normalized = normalizeDisplayText(value)?.toLowerCase() ?? null;
  if (normalized === null || UNKNOWN_QUEUE_STATUSES.has(normalized)) {
    if (
      expectedOperationDate !== null &&
      Date.parse(`${expectedOperationDate}T00:00:00Z`) <= Date.now()
    ) {
      return "complete";
    }
    return "active";
  }
  if (normalized.includes("withdraw")) {
    return "withdrawn";
  }
  if (normalized.includes("cancel")) {
    return "cancelled";
  }
  if (
    normalized.includes("operat") ||
    normalized.includes("commercial") ||
    normalized.includes("in service") ||
    normalized.includes("complete")
  ) {
    return "complete";
  }
  return collapseWhitespace(normalized.replaceAll("/", " ")).replaceAll(" ", "_");
}
function normalizeNativeQueueStatus(value) {
  return normalizeDisplayText(value);
}
const QUEUE_STATUS_STAGE_GROUP_MAP = new Map([
  ["active", "early_planning"],
  ["cancelled", "withdrawn"],
  ["canceled", "withdrawn"],
  ["complete", "operational"],
  ["deactivated", "withdrawn"],
  ["disis_stage", "active_study"],
  ["energization_approved", "operational"],
  ["engineering_and_procurement", "committed"],
  ["eras", "permitting_or_approval"],
  ["facility_study_stage", "active_study"],
  ["ia_fully_executed_on_schedule", "committed"],
  ["ia_fully_executed_on_suspension", "committed"],
  ["ia_pending", "permitting_or_approval"],
  ["pending_transfer", "permitting_or_approval"],
  ["suspended", "suspended_or_unknown"],
  ["suspended_or_unknown", "suspended_or_unknown"],
  ["under_construction", "construction"],
]);
function deriveQueueStageGroupFromNormalizedStatus(normalizedStatus) {
  if (normalizedStatus === null) {
    return "suspended_or_unknown";
  }

  return QUEUE_STATUS_STAGE_GROUP_MAP.get(normalizedStatus) ?? null;
}
function deriveQueueStageGroupFromNativeStatus(nativeStatus) {
  if (nativeStatus?.includes("study") === true) {
    return "active_study";
  }
  if (nativeStatus?.includes("permit") === true || nativeStatus?.includes("approval") === true) {
    return "permitting_or_approval";
  }

  return null;
}
function deriveQueueStageGroup(args) {
  const normalizedStatus = normalizeDisplayText(args.queueStatus)?.toLowerCase() ?? null;
  const nativeStatus = normalizeDisplayText(args.nativeStatus)?.toLowerCase() ?? null;
  const normalizedStageGroup = deriveQueueStageGroupFromNormalizedStatus(normalizedStatus);
  if (normalizedStageGroup !== null) {
    return normalizedStageGroup;
  }
  if (args.signedIa === true) {
    return "committed";
  }
  const nativeStageGroup = deriveQueueStageGroupFromNativeStatus(nativeStatus);
  if (nativeStageGroup !== null) {
    return nativeStageGroup;
  }

  return "suspended_or_unknown";
}
function parseVoltageKv(value) {
  const normalized = normalizeDisplayText(value);
  if (normalized === null) {
    return null;
  }
  const match = normalized.match(VOLTAGE_KV_REGEX);
  if (match === null) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}
function normalizeCountyNameFullKey(value) {
  return collapseWhitespace(
    stripDiacritics(value)
      .toLowerCase()
      .replaceAll("&", " and ")
      .replaceAll(".", " ")
      .replaceAll("'", "")
      .replaceAll(",", " ")
      .replaceAll("-", " ")
      .replaceAll(/\(.*?\)/gu, " ")
      .replaceAll(/\bst\b/gu, "saint")
      .replaceAll(/\bste\b/gu, "sainte")
  );
}
function normalizeCountyNameStrippedKey(value) {
  return collapseWhitespace(
    normalizeCountyNameFullKey(value)
      .replaceAll(/\bcity and borough\b/gu, " ")
      .replaceAll(/\bcensus area\b/gu, " ")
      .replaceAll(/\bmunicipality\b/gu, " ")
      .replaceAll(/\bborough\b/gu, " ")
      .replaceAll(/\bparish\b/gu, " ")
      .replaceAll(/\bcounty\b/gu, " ")
      .replaceAll(/\bcity\b/gu, " ")
      .replaceAll(/\bmunicipio\b/gu, " ")
  );
}
function normalizePlaceLookupKey(value) {
  return collapseWhitespace(
    stripDiacritics(value).toLowerCase().replace(PLACE_LOOKUP_CITY_OF_PREFIX_REGEX, "")
  );
}
function buildPlaceLookupKeyCandidates(value) {
  const normalizedKey = normalizePlaceLookupKey(value);
  const strippedKey = collapseWhitespace(normalizedKey.replace(PLACE_LOOKUP_SUFFIX_REGEX, ""));
  return dedupeStrings([normalizedKey, strippedKey].filter((candidate) => candidate.length > 0));
}
function utilityKey(utilityNumber, stateAbbrev) {
  return `${stateAbbrev}|${utilityNumber}`;
}
function stateBaKey(stateAbbrev, baCode) {
  return `${stateAbbrev}|${baCode ?? "unknown"}`;
}
function slugifyUtilityId(utilityNumber) {
  return `eia861-${utilityNumber}`;
}
function roundTo(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
function parseTwoDigitYear(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 99) {
    return null;
  }
  return parsed >= 70 ? 1900 + parsed : 2000 + parsed;
}
function parseCompactUsDate(month, day, year) {
  const parsedMonth = Number(month);
  const parsedDay = Number(day);
  const parsedYear = parseTwoDigitYear(year);
  if (
    !Number.isInteger(parsedMonth) ||
    parsedMonth < 1 ||
    parsedMonth > 12 ||
    !Number.isInteger(parsedDay) ||
    parsedDay < 1 ||
    parsedDay > 31 ||
    parsedYear === null
  ) {
    return null;
  }
  return `${String(parsedYear).padStart(4, "0")}-${String(parsedMonth).padStart(2, "0")}-${String(parsedDay).padStart(2, "0")}`;
}
function parseNwsDbxSourceDate(fileName) {
  const match = fileName.match(NWS_ZONE_COUNTY_DBX_FILE_NAME_PATTERN);
  if (match === null) {
    return null;
  }
  const day = match[2] ?? null;
  const monthAbbrev = (match[3] ?? "").toLowerCase();
  const year = match[4] ?? null;
  const month = NWS_FILE_MONTH_ABBREV_MAP.get(monthAbbrev) ?? null;
  if (day === null || year === null || month === null) {
    return null;
  }
  return parseCompactUsDate(String(month), day, year);
}
function slugifyText(value) {
  return collapseWhitespace(
    value
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/gu, "-")
      .replaceAll(/^-+|-+$/gu, "")
  );
}
function readOptionalYear(value) {
  const normalized = normalizeDisplayText(value);
  if (normalized === null) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed >= 1900 && parsed <= 2100 ? parsed : null;
}
function monthNameToNumber(value) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "january") {
    return 1;
  }
  if (normalized === "february") {
    return 2;
  }
  if (normalized === "march") {
    return 3;
  }
  if (normalized === "april") {
    return 4;
  }
  if (normalized === "may") {
    return 5;
  }
  if (normalized === "june") {
    return 6;
  }
  if (normalized === "july") {
    return 7;
  }
  if (normalized === "august") {
    return 8;
  }
  if (normalized === "september") {
    return 9;
  }
  if (normalized === "october") {
    return 10;
  }
  if (normalized === "november") {
    return 11;
  }
  if (normalized === "december") {
    return 12;
  }
  return null;
}
function parseWrittenMonthDate(monthName, day, year) {
  const month = monthNameToNumber(monthName);
  const parsedDay = Number(day);
  const parsedYear = Number(year);
  if (month === null || !Number.isInteger(parsedDay) || !Number.isInteger(parsedYear)) {
    return null;
  }
  return `${String(parsedYear).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(parsedDay).padStart(2, "0")}`;
}
function sleep(ms) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}
function externalFetchBackoffMs(attempt) {
  return EXTERNAL_FETCH_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1);
}
function firstDayOfMonth(value) {
  const utcYear = value.getUTCFullYear();
  const utcMonth = value.getUTCMonth() + 1;
  return `${String(utcYear)}-${String(utcMonth).padStart(2, "0")}-01`;
}
function toIsoDate(value) {
  return value.toISOString().slice(0, 10);
}
function toIsoTimestamp(value) {
  return value.toISOString().replace(ISO_TIMESTAMP_MILLISECONDS_SUFFIX_REGEX, "Z");
}
function formatSourceAsOfDate(value, fallback) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return toIsoDate(new Date(value));
}
function dedupeStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}
function formatBboxParam(bbox) {
  return `${String(bbox.west)},${String(bbox.south)},${String(bbox.east)},${String(bbox.north)}`;
}
function parseFiberLocatorLineIds(rawValue) {
  if (typeof rawValue !== "string") {
    throw new Error("FIBERLOCATOR_LINE_IDS is required");
  }
  const lineIds = dedupeStrings(
    rawValue
      .split(",")
      .map((value) => normalizeDisplayText(value)?.toLowerCase() ?? null)
      .filter((value) => value !== null)
  );
  if (lineIds.length === 0) {
    throw new Error("FIBERLOCATOR_LINE_IDS must include at least one branch");
  }
  return lineIds;
}
function normalizeApiBaseUrl(value) {
  const normalized = normalizeDisplayText(value);
  if (normalized === null) {
    return null;
  }
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}
function buildFiberLocatorTokenPathUrl(apiBaseUrl, staticToken, path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${apiBaseUrl}/${encodeURIComponent(staticToken)}${normalizedPath}`;
}
function buildFiberLocatorPublicPathUrl(apiBaseUrl, path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${apiBaseUrl}${normalizedPath}`;
}
function buildFiberLocatorLayersInViewPath(lineIds, bbox) {
  const encodedBbox = encodeURIComponent(formatBboxParam(bbox));
  const encodedBranches = lineIds.map((lineId) => encodeURIComponent(lineId)).join(",");
  return `/layers/inview/${encodedBbox}/${encodedBranches}`;
}
async function mapWithConcurrency(values, concurrency, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, values.length));
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        if (currentIndex >= values.length) {
          return;
        }
        results[currentIndex] = await mapper(values[currentIndex], currentIndex);
      }
    })
  );
  return results;
}
function buildCountyFipsAliasRecords() {
  return [...COUNTY_FIPS_ALIAS_RECORDS].sort((left, right) => {
    const leftKey = `${left.canonicalCountyFips}:${left.aliasCountyFips}`;
    const rightKey = `${right.canonicalCountyFips}:${right.aliasCountyFips}`;
    return leftKey.localeCompare(rightKey);
  });
}
function buildCountyFipsAliasLookup(aliasRecords) {
  const relatedCountyFips = new Map();
  const linkCountyFips = (leftCountyFips, rightCountyFips) => {
    const existingValues = relatedCountyFips.get(leftCountyFips) ?? new Set();
    existingValues.add(rightCountyFips);
    relatedCountyFips.set(leftCountyFips, existingValues);
  };
  for (const record of aliasRecords) {
    linkCountyFips(record.aliasCountyFips, record.canonicalCountyFips);
    linkCountyFips(record.canonicalCountyFips, record.aliasCountyFips);
  }
  return new Map(
    [...relatedCountyFips.entries()].map(([countyFips, values]) => [countyFips, [...values]])
  );
}
function expandCountyFipsAliases(aliasLookup, countyFips) {
  return dedupeStrings([countyFips, ...(aliasLookup.get(countyFips) ?? [])]);
}
function buildQueuePoiReferenceLookupKey(sourceSystem, stateAbbrev, queuePoiLabel) {
  return [sourceSystem, stateAbbrev ?? "", collapseWhitespace(queuePoiLabel.toLowerCase())].join(
    "|"
  );
}
function dedupeJsonRows(rows) {
  const seen = new Set();
  const result = [];
  for (const row of rows) {
    const key = JSON.stringify(row);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(row);
  }
  return result;
}
function buildWorksheetHeaders(rows, headerRowIndexes) {
  const maxColumnCount = rows.reduce((result, row) => Math.max(result, row.length), 0);
  const headers = [];
  for (let columnIndex = 0; columnIndex < maxColumnCount; columnIndex += 1) {
    const labels = headerRowIndexes
      .map((rowIndex) => normalizeHeaderLabel(rows[rowIndex]?.[columnIndex]))
      .filter((value) => value !== null)
      .filter((value) => !GENERIC_HEADER_LABELS.has(value));
    const dedupedLabels = dedupeStrings(labels);
    headers.push(
      dedupedLabels.length > 0 ? dedupedLabels.join("__") : `column_${String(columnIndex + 1)}`
    );
  }
  return headers;
}
function isRowEmpty(row) {
  return row.every((cell) => normalizeHeaderLabel(cell) === null);
}
function readWorkbookRecords(args) {
  const workbook = readFile(args.workbookPath, {
    cellDates: false,
    dense: true,
    raw: false,
  });
  const worksheet = workbook.Sheets[args.sheetName];
  if (typeof worksheet === "undefined") {
    throw new Error(`Missing worksheet "${args.sheetName}" in ${args.workbookPath}`);
  }
  const rows = utils.sheet_to_json(worksheet, {
    blankrows: false,
    defval: null,
    header: 1,
    raw: false,
  });
  const headers = buildWorksheetHeaders(rows, args.headerRowIndexes);
  const records = [];
  for (const row of rows.slice(args.firstDataRowIndex)) {
    if (isRowEmpty(row)) {
      continue;
    }
    const record = {};
    for (let index = 0; index < headers.length; index += 1) {
      const header = headers[index];
      if (typeof header !== "string") {
        continue;
      }
      const rawValue = row[index];
      record[header] = normalizeDisplayText(typeof rawValue === "string" ? rawValue : null);
    }
    records.push(record);
  }
  return records;
}
function _readRequiredText(record, field, context) {
  const value = normalizeDisplayText(record[field]);
  if (value === null) {
    throw new Error(`Missing workbook field "${field}" for ${context}`);
  }
  return value;
}
function mapOwnershipToTerritoryType(ownershipType, deliveryCompanyFlag) {
  if (deliveryCompanyFlag) {
    return "tdu";
  }
  if (ownershipType === null) {
    return null;
  }
  if (ownershipType === "Cooperative") {
    return "co_op";
  }
  if (ownershipType === "Investor Owned") {
    return "investor_owned";
  }
  if (ownershipType === "Municipal") {
    return "muni";
  }
  if (ownershipType === "Community Choice Aggregator") {
    return "cca";
  }
  if (ownershipType === "Retail Power Marketer") {
    return "retail_marketer";
  }
  if (ownershipType === "Wholesale Power Marketer") {
    return "wholesale_marketer";
  }
  if (ownershipType === "Transmission") {
    return "transmission";
  }
  if (
    ownershipType === "Federal" ||
    ownershipType === "Municipal Mktg Authority" ||
    ownershipType === "Political Subdivision" ||
    ownershipType === "State"
  ) {
    return "public_power";
  }
  if (ownershipType === "Behind the Meter") {
    return "behind_the_meter";
  }
  return collapseWhitespace(ownershipType.toLowerCase()).replaceAll(" ", "_");
}
function classifyUtilityRetailChoiceStatus(args) {
  if (args.choiceMwh > 0 && args.bundledMwh > 0) {
    return "partial_choice";
  }
  if (args.choiceMwh > 0) {
    return "choice";
  }
  if (args.bundledMwh > 0) {
    return "bundled_monopoly";
  }
  if (args.retailMarketingFlag) {
    return "choice";
  }
  return "unknown";
}
function classifyCountyRetailChoiceStatus(args) {
  if (args.choiceMwh > 0 && args.bundledMwh > 0) {
    return "partial_choice";
  }
  if (args.choiceMwh > 0) {
    return "choice";
  }
  if (args.bundledMwh > 0) {
    return "bundled_monopoly";
  }
  if (args.fallbackShare !== null) {
    if (args.fallbackShare >= 0.95) {
      return "choice";
    }
    if (args.fallbackShare > 0.05) {
      return "partial_choice";
    }
    return "bundled_monopoly";
  }
  const distinctStatuses = new Set(
    args.utilityStatuses.filter((value) => value !== "unknown" && value !== "mixed")
  );
  if (distinctStatuses.size > 1) {
    return "mixed";
  }
  const first = distinctStatuses.values().next().value;
  return typeof first === "string" ? first : "unknown";
}
function classifyCountyCompetitiveAreaType(args) {
  const distinctTerritoryTypes = new Set(
    args.territoryTypes.filter((value) => typeof value === "string" && value.length > 0)
  );
  if (args.countyRetailChoiceStatus === "partial_choice") {
    return "mixed";
  }
  if (args.countyRetailChoiceStatus === "mixed" || distinctTerritoryTypes.size > 1) {
    return "mixed";
  }
  if (args.countyRetailChoiceStatus === "choice") {
    return "choice";
  }
  if (
    args.marketOperator === "ERCOT" &&
    args.stateAbbrev === "TX" &&
    (args.dominantTerritoryType === "muni" || args.dominantTerritoryType === "co_op")
  ) {
    return "noie";
  }
  if (args.dominantTerritoryType === "muni") {
    return "muni";
  }
  if (args.dominantTerritoryType === "co_op") {
    return "co_op";
  }
  if (args.countyRetailChoiceStatus === "bundled_monopoly") {
    return "bundled";
  }
  return "unknown";
}
function determineCountyMarketStructure(args) {
  const organizedCount = dedupeStrings(args.operators).length;
  if (organizedCount > 1) {
    return "mixed";
  }
  if (organizedCount > 0) {
    return "organized_market";
  }
  if (args.traditionalCount > 0) {
    return "traditional_vertical";
  }
  return "unknown";
}
function readStateOrganizedOperatorCandidates(stateAbbrev) {
  return stateAbbrev === null
    ? null
    : (STATE_ORGANIZED_OPERATOR_CANDIDATES.get(stateAbbrev) ?? null);
}
function filterOrganizedOperatorsForState(operators, stateAbbrev) {
  const allowedOperators = readStateOrganizedOperatorCandidates(stateAbbrev);
  if (allowedOperators === null) {
    return [];
  }
  return dedupeStrings(operators.filter((operator) => allowedOperators.has(operator)));
}
function resolveOrganizedOperatorFromBalancingAuthority(baCode) {
  return baCode === null ? null : (BALANCING_AUTHORITY_ORGANIZED_OPERATOR_MAP.get(baCode) ?? null);
}
function addWeightedOperator(weights, operator, weight) {
  const existingWeight = weights.get(operator) ?? 0;
  weights.set(operator, existingWeight + weight);
}
function chooseDominantOperator(weights) {
  let bestOperator = null;
  let bestWeight = Number.NEGATIVE_INFINITY;
  for (const entry of weights.entries()) {
    const [operator, weight] = entry;
    if (weight > bestWeight) {
      bestOperator = operator;
      bestWeight = weight;
    }
  }
  return bestOperator;
}
function readUnknownRecordArray(value) {
  if (!Array.isArray(value)) {
    throw new Error("Expected query result rows array");
  }
  const rows = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error("Expected query row object");
    }
    rows.push(item);
  }
  return rows;
}
async function fetchText(url, init) {
  let attempt = 1;
  while (true) {
    try {
      const response = await fetchWithTimeout(url, init);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch ${url}: ${String(response.status)} ${response.statusText}`
        );
      }
      return await response.text();
    } catch (error) {
      if (attempt >= EXTERNAL_FETCH_RETRY_ATTEMPTS) {
        throw error;
      }
      await sleep(externalFetchBackoffMs(attempt));
      attempt += 1;
    }
  }
}
async function fetchJson(url, init) {
  return JSON.parse(await fetchText(url, init));
}
async function downloadFile(url, destinationPath, init) {
  const response = await fetchWithTimeout(url, init);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${String(response.status)} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  ensureDirectory(dirname(destinationPath));
  await bunRuntime.write(destinationPath, arrayBuffer);
}
async function readZipTextFile(zipPath) {
  const listResult = await runBufferedCommand({
    args: ["-Z1", zipPath],
    command: "unzip",
    cwd: dirname(zipPath),
  });
  if (listResult.exitCode !== 0) {
    throw new Error(
      listResult.stderr.trim().length > 0 ? listResult.stderr.trim() : listResult.stdout.trim()
    );
  }
  const memberName =
    listResult.stdout
      .split(CSV_LINE_SPLIT_REGEX)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? null;
  if (memberName === null) {
    throw new Error(`ZIP archive ${zipPath} did not contain a readable member`);
  }
  const extractResult = await runBufferedCommand({
    args: ["-p", zipPath, memberName],
    command: "unzip",
    cwd: dirname(zipPath),
    stdout: {
      captureMaxBytes: ZIP_TEXT_CAPTURE_MAX_BYTES,
    },
  });
  if (extractResult.exitCode !== 0) {
    throw new Error(
      extractResult.stderr.trim().length > 0
        ? extractResult.stderr.trim()
        : extractResult.stdout.trim()
    );
  }
  return extractResult.stdout;
}
async function downloadZipTextFromUrl(args) {
  await downloadFile(args.url, args.zipPath);
  return readZipTextFile(args.zipPath);
}
async function unzipFiles(args) {
  const result = await runBufferedCommand({
    args: ["-o", args.zipPath, ...args.fileNames],
    command: "unzip",
    cwd: args.destinationDir,
  });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim().length > 0 ? result.stderr.trim() : result.stdout.trim());
  }
}
async function fetchWithTimeout(url, init) {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    controller.abort();
  }, EXTERNAL_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Timed out fetching ${url} after ${String(EXTERNAL_FETCH_TIMEOUT_MS)}ms`);
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
function resolveLinkedDocumentUrl(args) {
  const match = args.html.match(args.pattern);
  const href = typeof match?.[1] === "string" ? match[1] : null;
  if (href === null) {
    throw new Error(args.notFoundMessage);
  }
  return href.startsWith("http") ? href : new URL(href, args.pageUrl).toString();
}
function findWorksheetHeaderRowIndex(rows, expectedHeaders) {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const normalizedRow = row
      .map((value) => normalizeDisplayText(value))
      .filter((value) => value !== null);
    if (expectedHeaders.every((header) => normalizedRow.includes(header))) {
      return rowIndex;
    }
  }
  return null;
}
function readWorksheetRecordsByHeaders(args) {
  const headerRowIndex = findWorksheetHeaderRowIndex(args.rows, args.expectedHeaders);
  if (headerRowIndex === null) {
    throw new Error(`Unable to locate worksheet headers for ${args.context}`);
  }
  return readWorksheetRecordRows(args.rows, headerRowIndex, headerRowIndex + 1);
}
async function fetchIsoNeQueuePage() {
  const redirectResponse = await fetchWithTimeout(ISO_NE_QUEUE_SOURCE_PAGE_URL, {
    redirect: "manual",
  });
  const cookieHeader = extractCookieHeader(redirectResponse.headers.getSetCookie());
  if (redirectResponse.status !== 302 || cookieHeader.length === 0) {
    throw new Error("Unable to initialize the public ISO-NE IRTT queue session");
  }
  const response = await fetchWithTimeout(
    `${ISO_NE_QUEUE_SOURCE_PAGE_URL}?AspxAutoDetectCookieSupport=1`,
    {
      headers: {
        cookie: cookieHeader,
      },
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to fetch the ISO-NE public queue page: ${String(response.status)} ${response.statusText}`
    );
  }
  return {
    html: await response.text(),
    sourceAsOfDate: null,
  };
}
async function fetchIsoNeIsoexpressPage(url) {
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${String(response.status)} ${response.statusText}`);
  }
  const cookieHeader = extractCookieHeader(response.headers.getSetCookie());
  return {
    cookieHeader,
    html: await response.text(),
  };
}
async function fetchIsoNeIsoexpressText(args) {
  const response = await fetchWithTimeout(args.url, {
    headers:
      args.cookieHeader.length === 0
        ? {}
        : {
            cookie: args.cookieHeader,
          },
  });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${args.url}: ${String(response.status)} ${response.statusText}`
    );
  }
  return response.text();
}
function parseOptionalIsoDate(value) {
  const normalized = normalizeDisplayText(value);
  if (normalized === null) {
    return null;
  }
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return toIsoDate(new Date(parsed));
}
function normalizeUsStateAbbrev(value) {
  const normalized = normalizeDisplayText(value)?.toUpperCase() ?? null;
  return normalized !== null && normalized.length === 2 ? normalized : null;
}
function normalizeTruthyFlag(value) {
  const normalized = normalizeDisplayText(value)?.toLowerCase() ?? null;
  if (normalized === null) {
    return null;
  }
  if (["yes", "y", "true"].includes(normalized)) {
    return true;
  }
  if (["no", "n", "false"].includes(normalized)) {
    return false;
  }
  return null;
}
function resolveCountyFipsFromCountyName(args) {
  const countyMatches = resolveCountyFipsCandidatesFromCountyName(args);
  return countyMatches.length === 1 ? (countyMatches[0] ?? null) : null;
}
function buildCountyNameCandidates(stateAbbrev, countyName) {
  return dedupeStrings(
    [
      countyName,
      `${countyName} County`,
      `${countyName} Parish`,
      countyName.replace(COUNTY_NAME_CITY_OF_PREFIX_REGEX, "").length === countyName.length
        ? null
        : `${countyName.replace(COUNTY_NAME_CITY_OF_PREFIX_REGEX, "")} city`,
      countyName.replace(COUNTY_NAME_CITY_SUFFIX_REGEX, "").length === countyName.length
        ? null
        : `${countyName.replace(COUNTY_NAME_CITY_SUFFIX_REGEX, "")} city`,
      ...(stateAbbrev === null
        ? []
        : (COUNTY_NAME_STATE_ALIAS_MAP.get(buildCountyAliasKey(stateAbbrev, countyName)) ?? [])),
    ].filter((value) => value !== null)
  );
}
function collectCountyFipsMatches(args) {
  const matches = [];
  const pushUniqueMatch = (candidateName) => {
    const uniqueMatch = resolveUniqueCountyFips(args.lookupMaps, candidateName);
    if (uniqueMatch !== null) {
      matches.push(uniqueMatch);
    }
  };
  for (const candidateName of args.candidateNames) {
    if (args.stateAbbrev !== null) {
      const directMatch = resolveCountyFips(args.lookupMaps, args.stateAbbrev, candidateName);
      if (directMatch !== null) {
        matches.push(directMatch);
      }
      continue;
    }
    pushUniqueMatch(candidateName);
  }
  return matches;
}
function resolveCountyFipsCandidatesFromCountyName(args) {
  const countyName = normalizeDisplayText(args.countyName);
  if (countyName === null) {
    return [];
  }
  const normalizedCountyName = countyName.toLowerCase();
  if (normalizedCountyName === "unknown" || normalizedCountyName === "n/a") {
    return [];
  }
  const countyNameCandidates = buildCountyNameCandidates(args.stateAbbrev ?? null, countyName);
  const matches = collectCountyFipsMatches({
    candidateNames: countyNameCandidates,
    lookupMaps: args.lookupMaps,
    stateAbbrev: args.stateAbbrev ?? null,
  });
  if (COUNTY_NAME_SPLIT_REGEX.test(countyName)) {
    for (const part of countyName
      .split(COUNTY_NAME_SPLIT_REGEX)
      .map((value) => normalizeDisplayText(value))
      .filter((value) => value !== null)) {
      matches.push(
        ...collectCountyFipsMatches({
          candidateNames: buildCountyNameCandidates(args.stateAbbrev ?? null, part),
          lookupMaps: args.lookupMaps,
          stateAbbrev: args.stateAbbrev ?? null,
        })
      );
    }
  }
  if (matches.length === 0) {
    matches.push(
      ...collectCountyFipsMatches({
        candidateNames: countyNameCandidates,
        lookupMaps: args.lookupMaps,
        stateAbbrev: null,
      })
    );
  }
  return dedupeStrings(matches);
}
function decodeXmlEntities(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&apos;", "'")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&quot;", '"');
}
function extractCookieHeader(setCookies) {
  return setCookies
    .map((cookie) => normalizeDisplayText(cookie)?.split(";")[0] ?? null)
    .filter((value) => value !== null)
    .join("; ");
}
function extractHtmlCellText(cellHtml) {
  const fallbackTitle =
    normalizeDisplayText(cellHtml.match(HTML_TITLE_ATTRIBUTE_PATTERN)?.[1] ?? null) ?? null;
  const text = normalizeDisplayText(
    decodeXmlEntities(
      cellHtml
        .replaceAll(/<br\s*\/?>/giu, " ")
        .replaceAll(/<img[^>]*>/giu, " ")
        .replaceAll(/<[^>]+>/gu, " ")
    )
  );
  return text ?? fallbackTitle;
}
function readHtmlTableRowsById(html, tableId) {
  const tableMatch = html.match(
    new RegExp(`<table[^>]*id=["']${tableId}["'][^>]*>([\\s\\S]*?)</table>`, "iu")
  );
  if (tableMatch === null) {
    throw new Error(`Unable to locate HTML table "${tableId}"`);
  }
  const tableHtml = tableMatch[1] ?? "";
  const headerMatch = tableHtml.match(HTML_TABLE_HEADER_PATTERN);
  if (headerMatch === null) {
    throw new Error(`HTML table "${tableId}" is missing a header row`);
  }
  const headers = [...(headerMatch[1] ?? "").matchAll(/<th[^>]*>([\s\S]*?)<\/th>/giu)]
    .map((match) => extractHtmlCellText(match[1] ?? ""))
    .filter((value) => value !== null);
  const bodyMatch = tableHtml.match(HTML_TABLE_BODY_PATTERN);
  if (bodyMatch === null) {
    throw new Error(`HTML table "${tableId}" is missing a table body`);
  }
  return [...(bodyMatch[1] ?? "").matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/giu)]
    .map((match) => [...(match[1] ?? "").matchAll(/<td[^>]*>([\s\S]*?)<\/td>/giu)])
    .map((matches) => matches.map((match) => extractHtmlCellText(match[1] ?? "")))
    .filter((cells) => cells.length === headers.length)
    .map((cells) =>
      headers.reduce((record, header, index) => {
        record[header] = cells[index] ?? null;
        return record;
      }, {})
    );
}
function readPjmXmlChildText(projectXml, tagName) {
  const match = projectXml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "u"));
  if (match === null) {
    return null;
  }
  return normalizeDisplayText(decodeXmlEntities(match[1] ?? ""));
}
function pickLatestDate(values) {
  let latestDate = null;
  let latestTimestamp = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const parsed = Date.parse(`${value}T00:00:00Z`);
    if (!Number.isFinite(parsed) || parsed <= latestTimestamp) {
      continue;
    }
    latestTimestamp = parsed;
    latestDate = value;
  }
  return latestDate;
}
function sanitizeLocationSearchText(value) {
  const normalized = normalizeDisplayText(value);
  if (normalized === null) {
    return null;
  }
  return collapseWhitespace(
    stripDiacritics(normalized)
      .replaceAll(/\bannex\b/giu, " ")
      .replaceAll(/\bcable\b/giu, " ")
      .replaceAll(/\benergy storage\b/giu, " ")
      .replaceAll(/\bexpansion\b/giu, " ")
      .replaceAll(/\bexport\b/giu, " ")
      .replaceAll(/\bhvdc\b/giu, " ")
      .replaceAll(/\bimport\b/giu, " ")
      .replaceAll(/\binterconnect(?:ion)?\b/giu, " ")
      .replaceAll(/\bline\b/giu, " ")
      .replaceAll(/\bpower\b/giu, " ")
      .replaceAll(/\breconductoring\b/giu, " ")
      .replaceAll(/\breinforcement\b/giu, " ")
      .replaceAll(/\bsubstation\b/giu, " ")
      .replaceAll(/\bswitchyard\b/giu, " ")
      .replaceAll(/\bswitching\b/giu, " ")
      .replaceAll(/\bstation\b/giu, " ")
      .replaceAll(/\btie\b/giu, " ")
      .replaceAll(/\btownship\b/giu, " ")
      .replaceAll(/\buprate\b/giu, " ")
      .replaceAll(/\benergy center\b/giu, " ")
      .replaceAll(/\bsolar\b/giu, " ")
      .replaceAll(/\bwind\b/giu, " ")
      .replaceAll(/\bbattery\b/giu, " ")
      .replaceAll(/\bstorage\b/giu, " ")
      .replaceAll(/\bproject\b/giu, " ")
      .replaceAll(/\bplant\b/giu, " ")
      .replaceAll(/\bfacility\b/giu, " ")
      .replaceAll(/\bline tap\b/giu, " ")
      .replaceAll(/\bbus[#\s0-9]+\b/giu, " ")
      .replaceAll(/\b\d+(?:\.\d+)?\s*k?v\b/giu, " ")
      .replaceAll(/\b[a-z]\b$/giu, " ")
      .replaceAll(/[()]/gu, " ")
      .replaceAll(/\s*-\s*/gu, " ")
  );
}
function buildLocationSearchCandidates(value) {
  const locationValue = normalizeDisplayText(value);
  if (locationValue === null) {
    return [];
  }
  const rawParts = locationValue
    .split(/\s*(?:-|\/|,|&)\s*|\band\b|\bto\b/giu)
    .map((part) => normalizeDisplayText(part))
    .filter((part) => part !== null);
  return dedupeStrings(
    [locationValue, sanitizeLocationSearchText(locationValue), ...rawParts]
      .flatMap((candidate) => {
        if (candidate === null) {
          return [];
        }
        return [candidate, sanitizeLocationSearchText(candidate)];
      })
      .filter((candidate) => candidate !== null && candidate.length > 1)
  );
}
function resolveSingleCountyMatch(matches) {
  const uniqueMatches = dedupeStrings(matches.filter((match) => typeof match === "string"));
  return uniqueMatches.length === 1 ? (uniqueMatches[0] ?? null) : null;
}
function resolveCountyFipsFromLocationName(args) {
  if (args.stateAbbrev === null) {
    return null;
  }
  const matches = [];
  for (const candidate of buildLocationSearchCandidates(args.locationName)) {
    const directMatch = resolveCountyFips(args.lookupMaps, args.stateAbbrev, candidate);
    if (directMatch !== null) {
      matches.push(directMatch);
    }
    for (const splitCandidate of splitSppLocationCandidates(candidate)) {
      const candidateMatch = resolveCountyFips(args.lookupMaps, args.stateAbbrev, splitCandidate);
      if (candidateMatch !== null) {
        matches.push(candidateMatch);
      }
    }
  }
  return resolveSingleCountyMatch(matches);
}
function resolveCountyFipsFromPlaceName(args) {
  const placeName = normalizeDisplayText(args.placeName);
  if (placeName === null) {
    return null;
  }
  const matches = [];
  for (const candidateText of buildLocationSearchCandidates(placeName)) {
    for (const candidateKey of buildPlaceLookupKeyCandidates(candidateText)) {
      const stateSpecificCountyFips =
        args.stateAbbrev === null
          ? null
          : (args.placeCountyLookup.get(`${args.stateAbbrev}|${candidateKey}`) ?? null);
      if (stateSpecificCountyFips !== null) {
        matches.push(stateSpecificCountyFips);
        continue;
      }
      const nationalCountyFips = args.placeCountyLookup.get(`*|${candidateKey}`) ?? null;
      if (nationalCountyFips !== null) {
        matches.push(nationalCountyFips);
      }
    }
  }
  return resolveSingleCountyMatch(matches);
}
function resolveCountyFipsFromLocationCandidates(args) {
  const matches = [];
  for (const locationValue of args.locationValues) {
    const locationName = normalizeDisplayText(locationValue);
    if (locationName === null) {
      continue;
    }
    const directMatch = resolveCountyFipsFromLocationName({
      locationName,
      lookupMaps: args.lookupMaps,
      stateAbbrev: args.stateAbbrev,
    });
    if (directMatch !== null) {
      matches.push(directMatch);
    }
    const placeMatch = resolveCountyFipsFromPlaceName({
      placeCountyLookup: args.placeCountyLookup,
      placeName: locationName,
      stateAbbrev: args.stateAbbrev,
    });
    if (placeMatch !== null) {
      matches.push(placeMatch);
    }
  }
  return resolveSingleCountyMatch(matches);
}
function appendStateSpecificCountyCandidates(args) {
  if (args.stateAbbrev === null) {
    return;
  }

  for (const candidate of buildLocationSearchCandidates(args.locationName)) {
    const directMatch = resolveCountyFips(args.lookupMaps, args.stateAbbrev, candidate);
    if (directMatch !== null) {
      args.matches.push(directMatch);
    }
    for (const splitCandidate of splitSppLocationCandidates(candidate)) {
      const candidateMatch = resolveCountyFips(args.lookupMaps, args.stateAbbrev, splitCandidate);
      if (candidateMatch !== null) {
        args.matches.push(candidateMatch);
      }
    }
  }
}
function appendPlaceCountyCandidates(args) {
  for (const candidateText of buildLocationSearchCandidates(args.locationName)) {
    for (const candidateKey of buildPlaceLookupKeyCandidates(candidateText)) {
      const stateSpecificCountyFips =
        args.stateAbbrev === null
          ? null
          : (args.placeCountyLookup.get(`${args.stateAbbrev}|${candidateKey}`) ?? null);
      if (stateSpecificCountyFips !== null) {
        args.matches.push(stateSpecificCountyFips);
        continue;
      }
      const nationalCountyFips = args.placeCountyLookup.get(`*|${candidateKey}`) ?? null;
      if (nationalCountyFips !== null) {
        args.matches.push(nationalCountyFips);
      }
    }
  }
}
function resolveCountyFipsCandidateValuesFromLocationCandidates(args) {
  const matches = [];
  for (const locationValue of args.locationValues) {
    const locationName = normalizeDisplayText(locationValue);
    if (locationName === null) {
      continue;
    }
    appendStateSpecificCountyCandidates({
      locationName,
      lookupMaps: args.lookupMaps,
      matches,
      stateAbbrev: args.stateAbbrev,
    });
    appendPlaceCountyCandidates({
      locationName,
      matches,
      placeCountyLookup: args.placeCountyLookup,
      stateAbbrev: args.stateAbbrev,
    });
  }
  return dedupeStrings(matches);
}
function resolveCountyFipsFromCountyOrPlaceText(args) {
  const countyMatch = resolveCountyFipsFromCountyName({
    countyName: args.value,
    lookupMaps: args.lookupMaps,
    stateAbbrev: args.stateAbbrev,
  });
  if (countyMatch !== null) {
    return countyMatch;
  }
  return resolveCountyFipsFromLocationCandidates({
    locationValues: [args.value],
    lookupMaps: args.lookupMaps,
    placeCountyLookup: args.placeCountyLookup,
    stateAbbrev: args.stateAbbrev,
  });
}
function buildAllocationShares(count) {
  if (!Number.isInteger(count) || count <= 0) {
    return [];
  }
  const baseShare = roundTo(1 / count, 6);
  const shares = Array.from({ length: count }, () => baseShare);
  const runningTotal = shares
    .slice(0, Math.max(0, count - 1))
    .reduce((sum, share) => sum + share, 0);
  const lastIndex = count - 1;
  shares[lastIndex] = roundTo(Math.max(0, 1 - runningTotal), 6);
  return shares;
}
function buildQueueCountyResolutionRows(args) {
  const shares = buildAllocationShares(args.countyFipsValues.length);
  return args.countyFipsValues.map((countyFips, index) => ({
    allocationShare: shares[index] ?? 0,
    countyFips,
    marketId: args.marketId,
    projectId: args.projectId,
    queuePoiLabel: args.queuePoiLabel,
    resolverConfidence: args.resolverConfidence,
    resolverType: args.resolverType,
    sourceLocationLabel: args.sourceLocationLabel,
    sourceSystem: args.sourceSystem,
    stateAbbrev: args.stateAbbrev,
  }));
}
function inferQueueUnresolvedReason(args) {
  if (args.stateAbbrev === null) {
    return "missing_state";
  }
  if (args.candidateCountyFips.length > 1) {
    return "ambiguous_location";
  }
  const rawLocationLabel = normalizeDisplayText(args.sourceLocationLabel);
  const queuePoiLabel = normalizeDisplayText(args.queuePoiLabel);
  const locationCandidates = dedupeStrings(
    args.locationValues
      .map((value) => normalizeDisplayText(value))
      .filter((value) => value !== null)
  );
  const inspectionText = [rawLocationLabel, queuePoiLabel, ...locationCandidates]
    .filter((value) => value !== null)
    .join(" ")
    .toLowerCase();
  if (inspectionText.includes("offshore") || inspectionText.includes("intertie")) {
    return "offshore_or_interface";
  }
  if (
    inspectionText.includes("hvdc") ||
    inspectionText.includes("export") ||
    inspectionText.includes("import") ||
    inspectionText.includes("interface")
  ) {
    return "transmission_interface";
  }
  if (queuePoiLabel !== null) {
    return "unresolved_poi";
  }
  if (rawLocationLabel !== null || locationCandidates.length > 0) {
    return "unresolved_location_label";
  }
  return "missing_location";
}
function resolveQueueCountyResolution(args) {
  const explicitCountyFipsValues =
    Array.isArray(args.explicitCountyFipsValues) && args.explicitCountyFipsValues.length > 0
      ? dedupeStrings(args.explicitCountyFipsValues)
      : [];
  if (explicitCountyFipsValues.length > 0) {
    return {
      countyFips:
        explicitCountyFipsValues.length === 1 ? (explicitCountyFipsValues[0] ?? null) : null,
      queueCountyConfidence: "high",
      queueResolverType:
        explicitCountyFipsValues.length === 1 ? "manual_override" : "manual_multi_county",
      resolutions: buildQueueCountyResolutionRows({
        countyFipsValues: explicitCountyFipsValues,
        marketId: args.marketId,
        projectId: args.projectId,
        queuePoiLabel: args.queuePoiLabel,
        resolverConfidence: "high",
        resolverType:
          explicitCountyFipsValues.length === 1 ? "manual_override" : "manual_multi_county",
        sourceLocationLabel: args.sourceLocationLabel,
        sourceSystem: args.sourceSystem,
        stateAbbrev: args.stateAbbrev,
      }),
      unresolved: null,
    };
  }
  const countyFipsCandidates =
    args.sourceLocationLabel === null
      ? []
      : resolveCountyFipsCandidatesFromCountyName({
          countyName: args.sourceLocationLabel,
          lookupMaps: args.lookupMaps,
          stateAbbrev: args.stateAbbrev,
        });
  if (countyFipsCandidates.length > 1) {
    return {
      countyFips: null,
      queueCountyConfidence: "high",
      queueResolverType: "explicit_multi_county",
      resolutions: buildQueueCountyResolutionRows({
        countyFipsValues: countyFipsCandidates,
        marketId: args.marketId,
        projectId: args.projectId,
        queuePoiLabel: args.queuePoiLabel,
        resolverConfidence: "high",
        resolverType: "explicit_multi_county",
        sourceLocationLabel: args.sourceLocationLabel,
        sourceSystem: args.sourceSystem,
        stateAbbrev: args.stateAbbrev,
      }),
      unresolved: null,
    };
  }
  if (countyFipsCandidates.length === 1) {
    const countyFips = countyFipsCandidates[0] ?? null;
    return {
      countyFips,
      queueCountyConfidence: "high",
      queueResolverType: "explicit_county",
      resolutions:
        countyFips === null
          ? []
          : buildQueueCountyResolutionRows({
              countyFipsValues: [countyFips],
              marketId: args.marketId,
              projectId: args.projectId,
              queuePoiLabel: args.queuePoiLabel,
              resolverConfidence: "high",
              resolverType: "explicit_county",
              sourceLocationLabel: args.sourceLocationLabel,
              sourceSystem: args.sourceSystem,
              stateAbbrev: args.stateAbbrev,
            }),
      unresolved: null,
    };
  }
  const sourceCountyFips =
    args.sourceLocationLabel === null
      ? null
      : resolveCountyFipsFromCountyOrPlaceText({
          lookupMaps: args.lookupMaps,
          placeCountyLookup: args.placeCountyLookup,
          stateAbbrev: args.stateAbbrev,
          value: args.sourceLocationLabel,
        });
  if (sourceCountyFips !== null) {
    return {
      countyFips: sourceCountyFips,
      queueCountyConfidence: "medium",
      queueResolverType: "county_or_place_lookup",
      resolutions: buildQueueCountyResolutionRows({
        countyFipsValues: [sourceCountyFips],
        marketId: args.marketId,
        projectId: args.projectId,
        queuePoiLabel: args.queuePoiLabel,
        resolverConfidence: "medium",
        resolverType: "county_or_place_lookup",
        sourceLocationLabel: args.sourceLocationLabel,
        sourceSystem: args.sourceSystem,
        stateAbbrev: args.stateAbbrev,
      }),
      unresolved: null,
    };
  }
  const poiCountyFips = resolveCountyFipsFromLocationCandidates({
    locationValues: args.locationValues,
    lookupMaps: args.lookupMaps,
    placeCountyLookup: args.placeCountyLookup,
    stateAbbrev: args.stateAbbrev,
  });
  if (poiCountyFips !== null) {
    return {
      countyFips: poiCountyFips,
      queueCountyConfidence: "low",
      queueResolverType: "poi_lookup",
      resolutions: buildQueueCountyResolutionRows({
        countyFipsValues: [poiCountyFips],
        marketId: args.marketId,
        projectId: args.projectId,
        queuePoiLabel: args.queuePoiLabel,
        resolverConfidence: "low",
        resolverType: "poi_lookup",
        sourceLocationLabel: args.sourceLocationLabel,
        sourceSystem: args.sourceSystem,
        stateAbbrev: args.stateAbbrev,
      }),
      unresolved: null,
    };
  }
  const candidateCountyFips = dedupeStrings([
    ...countyFipsCandidates,
    ...resolveCountyFipsCandidateValuesFromLocationCandidates({
      locationValues: args.locationValues,
      lookupMaps: args.lookupMaps,
      placeCountyLookup: args.placeCountyLookup,
      stateAbbrev: args.stateAbbrev,
    }),
  ]);
  return {
    countyFips: null,
    queueCountyConfidence: null,
    queueResolverType: null,
    resolutions: [],
    unresolved: {
      candidateCountyFips,
      rawLocationLabel: normalizeDisplayText(args.sourceLocationLabel),
      unresolvedReason: inferQueueUnresolvedReason({
        candidateCountyFips,
        locationValues: args.locationValues,
        queuePoiLabel: args.queuePoiLabel,
        sourceLocationLabel: args.sourceLocationLabel,
        stateAbbrev: args.stateAbbrev,
      }),
    },
  };
}
function buildTransmissionOwnerStateMap(rows) {
  const candidatesByOwner = new Map();
  for (const row of rows) {
    const transmissionOwner = normalizeDisplayText(row.transmissionOwner);
    const stateAbbrev = normalizeUsStateAbbrev(row.state);
    if (transmissionOwner === null || stateAbbrev === null) {
      continue;
    }
    const existing = candidatesByOwner.get(transmissionOwner) ?? new Set();
    existing.add(stateAbbrev);
    candidatesByOwner.set(transmissionOwner, existing);
  }
  const ownerStateMap = new Map();
  for (const [owner, values] of candidatesByOwner.entries()) {
    ownerStateMap.set(owner, values.size === 1 ? ([...values][0] ?? null) : null);
  }
  return ownerStateMap;
}
async function resolveLatestDirectEia861ZipYear() {
  const currentYear = new Date().getUTCFullYear();
  for (let year = currentYear; year >= 2010; year -= 1) {
    const response = await fetchWithTimeout(`${EIA_861_ZIP_BASE_URL}f861${String(year)}.zip`, {
      headers: {
        Range: "bytes=0-0",
      },
      method: "GET",
      redirect: "manual",
    });
    if (!response.ok) {
      continue;
    }
    const contentType = normalizeDisplayText(response.headers.get("content-type"));
    if (contentType !== "application/x-zip-compressed") {
      continue;
    }
    return String(year);
  }
  return null;
}
async function resolveLatestEia861Zip() {
  const directYear = await resolveLatestDirectEia861ZipYear();
  if (directYear !== null) {
    return {
      url: `${EIA_861_ZIP_BASE_URL}f861${directYear}.zip`,
      year: directYear,
    };
  }
  const html = await fetchText(EIA_861_PAGE_URL);
  const matches = [...html.matchAll(EIA_861_ZIP_URL_PATTERN)];
  if (matches.length === 0) {
    throw new Error("Unable to locate the latest EIA-861 ZIP download");
  }
  let bestYear = "";
  let bestUrl = "";
  for (const match of matches) {
    const [, href, year] = match;
    if (typeof href !== "string" || typeof year !== "string") {
      continue;
    }
    if (year > bestYear) {
      bestYear = year;
      bestUrl = href.startsWith("http") ? href : new URL(href, EIA_861_PAGE_URL).toString();
    }
  }
  if (bestYear.length === 0 || bestUrl.length === 0) {
    throw new Error("Unable to resolve a valid EIA-861 ZIP URL");
  }
  return {
    url: bestUrl,
    year: bestYear,
  };
}
async function resolveLatestPlacesGazetteerSource() {
  const html = await fetchText(CENSUS_GAZETTEER_PAGE_URL);
  const matches = [...html.matchAll(CENSUS_PLACE_GAZETTEER_URL_PATTERN)];
  if (matches.length === 0) {
    throw new Error("Unable to locate the latest national Census places gazetteer ZIP");
  }
  let bestYear = "";
  let bestUrl = "";
  for (const match of matches) {
    const [, url, year] = match;
    if (typeof url !== "string" || typeof year !== "string") {
      continue;
    }
    if (year > bestYear) {
      bestYear = year;
      if (url.startsWith("//")) {
        bestUrl = `https:${url}`;
      } else if (url.startsWith("http")) {
        bestUrl = url;
      } else {
        bestUrl = new URL(url, CENSUS_GAZETTEER_PAGE_URL).toString();
      }
    }
  }
  if (bestYear.length === 0 || bestUrl.length === 0) {
    throw new Error("Unable to resolve a valid national Census places gazetteer ZIP URL");
  }
  return {
    url: bestUrl,
    year: bestYear,
  };
}
async function resolveLatestCountySubdivisionGazetteerSource() {
  const html = await fetchText(CENSUS_GAZETTEER_PAGE_URL);
  const matches = [...html.matchAll(CENSUS_COUSUB_GAZETTEER_URL_PATTERN)];
  if (matches.length === 0) {
    throw new Error("Unable to locate the latest national Census county subdivision gazetteer ZIP");
  }
  let bestYear = "";
  let bestUrl = "";
  for (const match of matches) {
    const [, url, year] = match;
    if (typeof url !== "string" || typeof year !== "string") {
      continue;
    }
    if (year > bestYear) {
      bestYear = year;
      if (url.startsWith("//")) {
        bestUrl = `https:${url}`;
      } else if (url.startsWith("http")) {
        bestUrl = url;
      } else {
        bestUrl = new URL(url, CENSUS_GAZETTEER_PAGE_URL).toString();
      }
    }
  }
  if (bestYear.length === 0 || bestUrl.length === 0) {
    throw new Error(
      "Unable to resolve a valid national Census county subdivision gazetteer ZIP URL"
    );
  }
  return {
    url: bestUrl,
    year: bestYear,
  };
}
async function resolveCommunitySolarPolicySource() {
  const html = await fetchText(COMMUNITY_SOLAR_POLICY_SUBMISSION_URL);
  const matches = [...html.matchAll(COMMUNITY_SOLAR_POLICY_FILE_URL_PATTERN)];
  const workbookUrl = matches[0]?.[1] ?? null;
  if (typeof workbookUrl !== "string" || workbookUrl.length === 0) {
    throw new Error("Unable to locate the current NLR community solar policy workbook");
  }
  const lastUpdatedMatch = html.match(COMMUNITY_SOLAR_POLICY_LAST_UPDATED_PATTERN);
  const lastUpdated =
    lastUpdatedMatch === null
      ? null
      : parseWrittenMonthDate(
          lastUpdatedMatch[1] ?? "",
          lastUpdatedMatch[2] ?? "",
          lastUpdatedMatch[3] ?? ""
        );
  if (lastUpdated === null) {
    throw new Error("Unable to resolve the NLR community solar policy last-updated date");
  }
  return {
    sourceAsOfDate: lastUpdated,
    url: workbookUrl,
  };
}
async function loadCountyLookup() {
  const queryResult = await bunRuntime.sql
    .unsafe(`
    SELECT
      county.county_fips AS county_geoid,
      county.county_name,
      county.state_abbrev,
      ST_XMin(Box2D(county.geom)) AS bbox_west,
      ST_YMin(Box2D(county.geom)) AS bbox_south,
      ST_XMax(Box2D(county.geom)) AS bbox_east,
      ST_YMax(Box2D(county.geom)) AS bbox_north
    FROM serve.boundary_county_geom_lod1
    AS county
    ORDER BY county_geoid
  `)
    .execute();
  const rows = readUnknownRecordArray(queryResult);
  return rows.map((row) => {
    const countyFips = normalizeDisplayText(
      typeof row.county_geoid === "string" ? row.county_geoid : null
    );
    const countyName = normalizeDisplayText(
      typeof row.county_name === "string" ? row.county_name : null
    );
    const stateAbbrev = normalizeDisplayText(
      typeof row.state_abbrev === "string" ? row.state_abbrev : null
    );
    const bboxWest = parseOptionalNumericLike(row.bbox_west);
    const bboxSouth = parseOptionalNumericLike(row.bbox_south);
    const bboxEast = parseOptionalNumericLike(row.bbox_east);
    const bboxNorth = parseOptionalNumericLike(row.bbox_north);
    if (
      countyFips === null ||
      countyName === null ||
      stateAbbrev === null ||
      bboxWest === null ||
      bboxSouth === null ||
      bboxEast === null ||
      bboxNorth === null
    ) {
      throw new Error("Invalid county lookup row in serve.boundary_county_geom_lod1");
    }
    return {
      bboxEast,
      bboxNorth,
      bboxSouth,
      bboxWest,
      countyFips,
      countyName,
      countyNameFullKey: normalizeCountyNameFullKey(countyName),
      countyNameStrippedKey: normalizeCountyNameStrippedKey(countyName),
      stateAbbrev,
    };
  });
}
function buildCountyLookupMaps(entries) {
  const fullMap = new Map();
  const strippedMap = new Map();
  for (const entry of entries) {
    const fullKey = `${entry.stateAbbrev}|${entry.countyNameFullKey}`;
    const strippedKey = `${entry.stateAbbrev}|${entry.countyNameStrippedKey}`;
    const fullMatches = fullMap.get(fullKey) ?? [];
    fullMatches.push(entry.countyFips);
    fullMap.set(fullKey, fullMatches);
    const strippedMatches = strippedMap.get(strippedKey) ?? [];
    strippedMatches.push(entry.countyFips);
    strippedMap.set(strippedKey, strippedMatches);
  }
  const buildUniqueMap = (valuesByKey) => {
    const uniqueMap = new Map();
    for (const [key, values] of valuesByKey.entries()) {
      const uniqueValues = dedupeStrings(values);
      if (uniqueValues.length === 1) {
        uniqueMap.set(key, uniqueValues[0] ?? null);
      }
    }
    return uniqueMap;
  };
  return {
    fullMap,
    strippedMap,
    uniqueFullMap: buildUniqueMap(fullMap),
    uniqueStrippedMap: buildUniqueMap(strippedMap),
  };
}
function buildUniqueLocationCountyLookup(entries) {
  const matches = new Map();
  const nationalMatches = new Map();
  for (const entry of entries) {
    for (const candidateKey of buildPlaceLookupKeyCandidates(entry.placeName)) {
      const key = `${entry.stateAbbrev}|${candidateKey}`;
      const existing = matches.get(key) ?? new Set();
      existing.add(entry.countyFips);
      matches.set(key, existing);
      const nationalExisting = nationalMatches.get(candidateKey) ?? new Set();
      nationalExisting.add(entry.countyFips);
      nationalMatches.set(candidateKey, nationalExisting);
    }
  }
  const lookup = new Map();
  for (const [key, countyFipsSet] of matches.entries()) {
    if (countyFipsSet.size !== 1) {
      continue;
    }
    const countyFips = countyFipsSet.values().next().value;
    if (typeof countyFips === "string" && countyFips.length > 0) {
      lookup.set(key, countyFips);
    }
  }
  for (const [candidateKey, countyFipsSet] of nationalMatches.entries()) {
    if (countyFipsSet.size !== 1) {
      continue;
    }
    const countyFips = countyFipsSet.values().next().value;
    if (typeof countyFips === "string" && countyFips.length > 0) {
      lookup.set(`*|${candidateKey}`, countyFips);
    }
  }
  return lookup;
}
function appendUniqueCountyLookup(baseMap, fillInMap) {
  const result = new Map(baseMap);
  for (const [key, countyFips] of fillInMap.entries()) {
    if (!result.has(key)) {
      result.set(key, countyFips);
    }
  }
  return result;
}
async function buildPlaceCountyLookup(args) {
  const placeRows = parsePipeDelimitedRecords(args.content)
    .map((record) => {
      const stateAbbrev = normalizeUsStateAbbrev(record.USPS);
      const placeName = normalizeDisplayText(record.NAME);
      const latitude = parseOptionalNumber(record.INTPTLAT);
      const longitude = parseOptionalNumber(record.INTPTLONG);
      if (stateAbbrev === null || placeName === null || latitude === null || longitude === null) {
        return null;
      }
      return {
        latitude,
        longitude,
        placeName,
        stateAbbrev,
      };
    })
    .filter((value) => value !== null);
  const entries = [];
  for (let index = 0; index < placeRows.length; index += 5000) {
    const batch = placeRows.slice(index, index + 5000);
    const rows = readUnknownRecordArray(
      await bunRuntime.sql
        .unsafe(
          `
            WITH place_data AS (
              SELECT
                NULLIF(place->>'stateAbbrev', '')::text AS state_abbrev,
                NULLIF(place->>'placeName', '')::text AS place_name,
                ST_SetSRID(
                  ST_MakePoint(
                    (place->>'longitude')::numeric,
                    (place->>'latitude')::numeric
                  ),
                  4326
                ) AS geom_4326
              FROM jsonb_array_elements($1::jsonb) AS place
            )
            SELECT
              place_data.state_abbrev,
              place_data.place_name,
              county.county_fips AS county_geoid
            FROM place_data
            JOIN serve.boundary_county_geom_lod1 AS county
              ON county.state_abbrev = place_data.state_abbrev
             AND county.geom && place_data.geom_4326
             AND ST_Intersects(county.geom, place_data.geom_4326)
          `,
          [batch]
        )
        .execute()
    );
    for (const row of rows) {
      const stateAbbrev = normalizeUsStateAbbrev(row.state_abbrev);
      const placeName = normalizeDisplayText(row.place_name);
      const countyFips = normalizeDisplayText(row.county_geoid);
      if (stateAbbrev === null || placeName === null || countyFips === null) {
        continue;
      }
      entries.push({
        countyFips,
        placeName,
        stateAbbrev,
      });
    }
  }
  return buildUniqueLocationCountyLookup(entries);
}
function buildCountySubdivisionLookup(args) {
  const entries = [];
  for (const row of parsePipeDelimitedRecords(args.content)) {
    const stateAbbrev = normalizeUsStateAbbrev(row.USPS);
    const placeName = normalizeDisplayText(row.NAME);
    const geoId = normalizeDisplayText(row.GEOID);
    const countyFips = geoId === null ? null : normalizeDisplayText(geoId.slice(0, 5));
    if (stateAbbrev === null || placeName === null || countyFips === null) {
      continue;
    }
    entries.push({
      countyFips,
      placeName,
      stateAbbrev,
    });
  }
  return buildUniqueLocationCountyLookup(entries);
}
function resolveCountyFips(lookupMaps, stateAbbrev, countyName) {
  const fullKey = `${stateAbbrev}|${normalizeCountyNameFullKey(countyName)}`;
  const fullMatches = lookupMaps.fullMap.get(fullKey);
  if (typeof fullMatches !== "undefined" && fullMatches.length === 1) {
    return fullMatches[0] ?? null;
  }
  const strippedKey = `${stateAbbrev}|${normalizeCountyNameStrippedKey(countyName)}`;
  const strippedMatches = lookupMaps.strippedMap.get(strippedKey);
  if (typeof strippedMatches !== "undefined" && strippedMatches.length === 1) {
    return strippedMatches[0] ?? null;
  }
  return null;
}
function resolveUniqueCountyFips(lookupMaps, countyName) {
  const fullKey = normalizeCountyNameFullKey(countyName);
  const fullMatch = lookupMaps.uniqueFullMap.get(fullKey);
  if (typeof fullMatch === "string" && fullMatch.length > 0) {
    return fullMatch;
  }
  const strippedKey = normalizeCountyNameStrippedKey(countyName);
  const strippedMatch = lookupMaps.uniqueStrippedMap.get(strippedKey);
  return typeof strippedMatch === "string" && strippedMatch.length > 0 ? strippedMatch : null;
}
function normalizeSppCountyCandidate(value) {
  return collapseWhitespace(
    value
      .replaceAll(/\bco\b/giu, "County")
      .replaceAll(/\bcnty\b/giu, "County")
      .replaceAll(/\bprsh\b/giu, "Parish")
      .replaceAll(/\bpar\b/giu, "Parish")
      .replaceAll("Goultry", "Goltry")
      .replaceAll("Cimmaron", "Cimarron")
      .replaceAll("Greely", "Greeley")
      .replaceAll("Indepedence", "Independence")
      .replaceAll("Lavenworth", "Leavenworth")
      .replaceAll("Buchan", "Buchanan")
      .replaceAll("Cury", "Curry")
      .replaceAll("Burbon", "Bourbon")
      .replaceAll("Pittsburgh", "Pittsburg")
      .replaceAll("Sedwick", "Sedgwick")
      .replaceAll("Stephen", "Stephens")
      .replaceAll("Neoshoe", "Neosho")
      .replaceAll("Carrol", "Carroll")
      .replaceAll("Wasita", "Washita")
      .replaceAll("Novata", "Nowata")
      .replaceAll("LeFlore", "Le Flore")
      .replaceAll("Commanche", "Comanche")
      .replaceAll("La Moure", "LaMoure")
      .replaceAll("Lynn County Texas", "Lynn County")
      .replaceAll("Pratt, KS", "Pratt County")
      .replaceAll("Missouri", "")
  );
}
function splitSppLocationCandidates(value) {
  const normalized = normalizeSppCountyCandidate(value)
    .replaceAll("&", ",")
    .replaceAll(SPP_LOCATION_AND_SPLIT_REGEX, ",")
    .replaceAll("/", ",");
  const candidates = normalized
    .split(",")
    .map((part) => collapseWhitespace(part))
    .filter((part) => part.length > 0)
    .map((part) =>
      COUNTY_OR_PARISH_SUFFIX_REGEX.test(part) ? part : collapseWhitespace(`${part} County`)
    );
  return dedupeStrings(candidates);
}
function resolveSppQueueCountyFips(args) {
  const locationKey = buildSppLocationOverrideKey(args.stateAbbrev, args.locationName);
  const override = SPP_QUEUE_LOCATION_OVERRIDES.get(locationKey);
  if (typeof override !== "undefined") {
    return resolveCountyFips(args.countyLookup, override.stateAbbrev, override.countyName);
  }
  const directMatch = resolveCountyFips(args.countyLookup, args.stateAbbrev, args.locationName);
  if (directMatch !== null) {
    return directMatch;
  }
  const placeMatch = resolveCountyFipsFromPlaceName({
    placeCountyLookup: args.placeCountyLookup,
    placeName: normalizeSppCountyCandidate(args.locationName),
    stateAbbrev: args.stateAbbrev,
  });
  if (placeMatch !== null) {
    return placeMatch;
  }
  const sanitizedLocation = sanitizeLocationSearchText(args.locationName);
  const sanitizedCountyMatch = resolveCountyFipsFromCountyName({
    countyName: sanitizedLocation,
    lookupMaps: args.countyLookup,
    stateAbbrev: args.stateAbbrev,
  });
  if (sanitizedCountyMatch !== null) {
    return sanitizedCountyMatch;
  }
  const sanitizedPlaceMatch = resolveCountyFipsFromPlaceName({
    placeCountyLookup: args.placeCountyLookup,
    placeName: sanitizedLocation,
    stateAbbrev: args.stateAbbrev,
  });
  if (sanitizedPlaceMatch !== null) {
    return sanitizedPlaceMatch;
  }
  const splitCandidates = splitSppLocationCandidates(args.locationName);
  for (const candidate of splitCandidates) {
    const resolvedCandidate = resolveCountyFips(args.countyLookup, args.stateAbbrev, candidate);
    if (resolvedCandidate !== null) {
      return resolvedCandidate;
    }
  }
  return resolveCountyFipsFromLocationCandidates({
    locationValues: [args.locationName],
    lookupMaps: args.countyLookup,
    placeCountyLookup: args.placeCountyLookup,
    stateAbbrev: args.stateAbbrev,
  });
}
function buildBalancingAuthorityNameMap(balancingAuthorityRows) {
  const nameMap = new Map();
  for (const row of balancingAuthorityRows) {
    const baCode = normalizeBalancingAuthorityCode(row["BA Code"]);
    const baName = normalizeDisplayText(row["Balancing Authority Name"]);
    if (baCode === null || baName === null || nameMap.has(baCode)) {
      continue;
    }
    nameMap.set(baCode, baName);
  }
  return nameMap;
}
function buildUtilityProfiles(utilityRows, deliveryCompanyUtilityKeys) {
  const profiles = new Map();
  for (const row of utilityRows) {
    const utilityNumber = normalizeDisplayText(row["Utility Number"]);
    const utilityName = normalizeDisplayText(row["Utility Name"]);
    const stateAbbrev = normalizeDisplayText(row.State);
    if (utilityNumber === null || utilityName === null || stateAbbrev === null) {
      continue;
    }
    const key = utilityKey(utilityNumber, stateAbbrev);
    const organizedOperators = ISO_OPERATORS.filter((operator) =>
      normalizeMarker(row[operator.header])
    ).map((operator) => operator.operator);
    const retailMarketingFlag = normalizeMarker(row["Retail Marketing"]);
    const bundledFlag = normalizeMarker(row.Bundled);
    const hasDistributionFlag = normalizeMarker(row.Distribution);
    const ownershipType = normalizeDisplayText(row["Ownership Type"]);
    const deliveryCompanyFlag = deliveryCompanyUtilityKeys.has(key);
    profiles.set(key, {
      bundledFlag,
      hasDistributionFlag,
      organizedOperators,
      ownershipType,
      retailMarketingFlag,
      stateAbbrev,
      territoryType: mapOwnershipToTerritoryType(ownershipType, deliveryCompanyFlag),
      utilityName,
      utilityNumber,
    });
  }
  return profiles;
}
function buildDeliveryCompanyUtilityKeys(deliveryRows) {
  const keys = new Set();
  for (const row of deliveryRows) {
    const utilityNumber = normalizeDisplayText(row["Utility Number"]);
    const stateAbbrev = normalizeDisplayText(row.State);
    const serviceType = normalizeDisplayText(row["Service Type"]);
    if (utilityNumber === null || stateAbbrev === null || serviceType !== "Delivery") {
      continue;
    }
    keys.add(utilityKey(utilityNumber, stateAbbrev));
  }
  return keys;
}
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Source workbook normalization requires branching by EIA service-type layout.
function buildSalesAggregates(salesRows, deliveryCompanyUtilityKeys) {
  const accumulators = new Map();
  for (const row of salesRows) {
    const utilityNumber = normalizeDisplayText(row["Utility Number"]);
    const utilityName = normalizeDisplayText(row["Utility Name"]);
    const stateAbbrev = normalizeDisplayText(row.State);
    const serviceType = normalizeDisplayText(row["Service Type"]);
    if (
      utilityNumber === null ||
      utilityName === null ||
      stateAbbrev === null ||
      serviceType === null
    ) {
      continue;
    }
    const key = utilityKey(utilityNumber, stateAbbrev);
    const existing = accumulators.get(key) ?? {
      baCode: null,
      bundledCustomers: 0,
      bundledMwh: 0,
      deliveryCompanyFlag: deliveryCompanyUtilityKeys.has(key),
      deliveryCustomers: 0,
      deliveryMwh: 0,
      energyCustomers: 0,
      energyMwh: 0,
      stateAbbrev,
      totalCustomers: 0,
      totalMwh: 0,
      utilityName,
      utilityNumber,
    };
    const totalCustomers = parseOptionalNumber(row.Customers__Count) ?? 0;
    const totalMwh = parseOptionalNumber(row.Sales__Megawatthours) ?? 0;
    const nextBaCode = normalizeBalancingAuthorityCode(row["BA Code"]);
    existing.totalCustomers += totalCustomers;
    existing.totalMwh += totalMwh;
    if (serviceType === "Bundled") {
      existing.bundledCustomers += totalCustomers;
      existing.bundledMwh += totalMwh;
    } else if (serviceType === "Delivery") {
      existing.deliveryCustomers += totalCustomers;
      existing.deliveryMwh += totalMwh;
    } else if (serviceType === "Energy") {
      existing.energyCustomers += totalCustomers;
      existing.energyMwh += totalMwh;
    }
    if (existing.baCode === null && nextBaCode !== null) {
      existing.baCode = nextBaCode;
    }
    accumulators.set(key, existing);
  }
  const aggregates = new Map();
  for (const entry of accumulators.entries()) {
    const [key, aggregate] = entry;
    const choiceMwh = aggregate.deliveryMwh > 0 ? aggregate.deliveryMwh : aggregate.energyMwh;
    const choiceCustomers =
      aggregate.deliveryCustomers > 0 ? aggregate.deliveryCustomers : aggregate.energyCustomers;
    aggregates.set(key, {
      ...aggregate,
      choiceCustomers,
      choiceMwh,
    });
  }
  return aggregates;
}
function buildCountyServiceTerritoryEntries(args) {
  const entries = [];
  const missing = [];
  for (const row of args.serviceTerritoryRows) {
    const utilityNumber = normalizeDisplayText(row["Utility Number"]);
    const utilityName = normalizeDisplayText(row["Utility Name"]);
    const stateAbbrev = normalizeDisplayText(row.State);
    const countyName = normalizeDisplayText(row.County);
    if (
      utilityNumber === null ||
      utilityName === null ||
      stateAbbrev === null ||
      countyName === null
    ) {
      continue;
    }
    const countyFipsValues = resolveCountyFipsCandidatesFromCountyName({
      countyName,
      lookupMaps: args.countyLookup,
      stateAbbrev,
    });
    if (countyFipsValues.length === 0) {
      missing.push(`${stateAbbrev}:${countyName}`);
      continue;
    }
    for (const countyFips of countyFipsValues) {
      entries.push({
        countyFips,
        stateAbbrev,
        utilityName,
        utilityNumber,
      });
    }
  }
  if (missing.length > 250) {
    throw new Error(
      `County service territory mapping left ${String(missing.length)} unmatched counties; first examples: ${missing.slice(0, 10).join(", ")}`
    );
  }
  return entries;
}
function buildTerritoryWideCountyServiceTerritoryEntries(args) {
  const countiesByState = new Map();
  for (const county of args.countyEntries) {
    const existing = countiesByState.get(county.stateAbbrev) ?? [];
    existing.push(county.countyFips);
    countiesByState.set(county.stateAbbrev, existing);
  }
  const entries = [];
  for (const row of args.territoryUtilityRows) {
    const utilityNumber = normalizeDisplayText(row["Utility Number"]);
    const utilityName = normalizeDisplayText(row["Utility Name"]);
    const stateAbbrev = normalizeDisplayText(row.State);
    if (utilityNumber === null || utilityName === null || stateAbbrev === null) {
      continue;
    }
    const countyFipsValues = countiesByState.get(stateAbbrev) ?? [];
    for (const countyFips of countyFipsValues) {
      entries.push({
        countyFips,
        stateAbbrev,
        utilityName,
        utilityNumber,
      });
    }
  }
  return entries;
}
function buildStateBaChoiceShareMap(salesAggregates) {
  const aggregates = new Map();
  for (const aggregate of salesAggregates.values()) {
    const key = stateBaKey(aggregate.stateAbbrev, aggregate.baCode);
    const existing = aggregates.get(key) ?? {
      baCode: aggregate.baCode,
      bundledMwh: 0,
      choiceMwh: 0,
      stateAbbrev: aggregate.stateAbbrev,
    };
    existing.bundledMwh += aggregate.bundledMwh;
    existing.choiceMwh += aggregate.choiceMwh;
    aggregates.set(key, existing);
  }
  return aggregates;
}
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: County retail context requires utility-level weighting and fallback classification in one pass.
function buildCountyUtilityContextRecords(args) {
  const territoryMap = new Map();
  for (const entry of args.countyServiceTerritoryEntries) {
    const existing = territoryMap.get(entry.countyFips) ?? [];
    existing.push(entry);
    territoryMap.set(entry.countyFips, existing);
  }
  const records = [];
  for (const county of args.countyEntries) {
    const serviceEntries = territoryMap.get(county.countyFips) ?? [];
    const seenUtilityKeys = new Set();
    const utilities = [];
    const territoryTypes = [];
    const utilityStatuses = [];
    let dominantUtilityName = null;
    let dominantUtilityId = null;
    let dominantTerritoryType = null;
    let dominantOperator = null;
    let dominantWeight = Number.NEGATIVE_INFINITY;
    let bundledMwh = 0;
    let choiceMwh = 0;
    let fallbackShare = null;
    for (const serviceEntry of serviceEntries) {
      const key = utilityKey(serviceEntry.utilityNumber, serviceEntry.stateAbbrev);
      if (seenUtilityKeys.has(key)) {
        continue;
      }
      seenUtilityKeys.add(key);
      const profile = args.utilityProfiles.get(key);
      const sales = args.salesAggregates.get(key);
      const utilityChoiceStatus = classifyUtilityRetailChoiceStatus({
        bundledMwh: sales?.bundledMwh ?? 0,
        choiceMwh: sales?.choiceMwh ?? 0,
        retailMarketingFlag: profile?.retailMarketingFlag ?? false,
      });
      const territoryType = profile?.territoryType ?? null;
      const utilityName = profile?.utilityName ?? serviceEntry.utilityName;
      utilities.push({
        retailChoiceStatus: utilityChoiceStatus,
        territoryType,
        utilityId: slugifyUtilityId(serviceEntry.utilityNumber),
        utilityName,
      });
      utilityStatuses.push(utilityChoiceStatus);
      if (territoryType !== null) {
        territoryTypes.push(territoryType);
      }
      bundledMwh += sales?.bundledMwh ?? 0;
      choiceMwh += sales?.choiceMwh ?? 0;
      if (fallbackShare === null && typeof sales !== "undefined" && sales.baCode !== null) {
        const stateBaShare = args.stateBaChoiceShares.get(
          stateBaKey(serviceEntry.stateAbbrev, sales.baCode)
        );
        if (
          typeof stateBaShare !== "undefined" &&
          stateBaShare.choiceMwh + stateBaShare.bundledMwh > 0
        ) {
          fallbackShare = roundTo(
            stateBaShare.choiceMwh / (stateBaShare.choiceMwh + stateBaShare.bundledMwh),
            4
          );
        }
      }
      const weight = sales?.totalMwh ?? 1;
      if (weight > dominantWeight) {
        dominantWeight = weight;
        dominantUtilityName = utilityName;
        dominantUtilityId = slugifyUtilityId(serviceEntry.utilityNumber);
        dominantTerritoryType = territoryType;
        dominantOperator =
          filterOrganizedOperatorsForState(
            profile?.organizedOperators ?? [],
            serviceEntry.stateAbbrev
          )[0] ?? null;
      }
    }
    const retailChoicePenetrationShare =
      bundledMwh + choiceMwh > 0 ? roundTo(choiceMwh / (bundledMwh + choiceMwh), 4) : fallbackShare;
    const retailChoiceStatus = classifyCountyRetailChoiceStatus({
      bundledMwh,
      choiceMwh,
      fallbackShare: retailChoicePenetrationShare,
      utilityStatuses,
    });
    const competitiveAreaType = classifyCountyCompetitiveAreaType({
      countyRetailChoiceStatus: retailChoiceStatus,
      dominantTerritoryType,
      marketOperator: dominantOperator,
      stateAbbrev: county.stateAbbrev,
      territoryTypes,
    });
    records.push({
      competitiveAreaType,
      countyFips: county.countyFips,
      dominantUtilityId,
      dominantUtilityName,
      primaryTduOrUtility: dominantUtilityName,
      retailChoicePenetrationShare,
      retailChoiceStatus,
      territoryType: dominantTerritoryType,
      utilities: utilities.sort((left, right) =>
        (left.utilityName ?? "").localeCompare(right.utilityName ?? "")
      ),
      utilityCount: utilities.length,
    });
  }
  return records;
}
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: County market structure is derived from combined utility, BA, and organized-market signals.
function buildCountyPowerMarketRecords(args) {
  const territoryMap = new Map();
  for (const entry of args.countyServiceTerritoryEntries) {
    const existing = territoryMap.get(entry.countyFips) ?? [];
    existing.push(entry);
    territoryMap.set(entry.countyFips, existing);
  }
  const records = [];
  for (const county of args.countyEntries) {
    const serviceEntries = territoryMap.get(county.countyFips) ?? [];
    const operatorWeights = new Map();
    const baWeights = new Map();
    const baNames = new Map();
    let dominantUtilityName = null;
    let dominantUtilityWeight = Number.NEGATIVE_INFINITY;
    let traditionalCount = 0;
    let dominantBaCode = null;
    let dominantBaWeight = Number.NEGATIVE_INFINITY;
    for (const serviceEntry of serviceEntries) {
      const key = utilityKey(serviceEntry.utilityNumber, serviceEntry.stateAbbrev);
      const profile = args.utilityProfiles.get(key);
      const sales = args.salesAggregates.get(key);
      const weight = sales?.totalMwh ?? 1;
      const utilityName = profile?.utilityName ?? serviceEntry.utilityName;
      const baCode = typeof sales === "undefined" ? null : sales.baCode;
      const baOperator = resolveOrganizedOperatorFromBalancingAuthority(baCode);
      const profileOperators =
        typeof profile === "undefined"
          ? []
          : filterOrganizedOperatorsForState(profile.organizedOperators, county.stateAbbrev);
      if (weight > dominantUtilityWeight) {
        dominantUtilityName = utilityName;
        dominantUtilityWeight = weight;
      }
      if (baOperator !== null) {
        addWeightedOperator(operatorWeights, baOperator, weight);
      } else if (profileOperators.length > 0) {
        for (const operator of profileOperators) {
          addWeightedOperator(operatorWeights, operator, weight);
        }
      } else {
        traditionalCount += 1;
      }
      if (baCode !== null) {
        const existingBaWeight = baWeights.get(baCode) ?? 0;
        baWeights.set(baCode, existingBaWeight + weight);
        const baName = args.balancingAuthorityNameMap.get(baCode);
        if (typeof baName === "string") {
          baNames.set(baCode, baName);
        }
        if (existingBaWeight + weight > dominantBaWeight) {
          dominantBaCode = baCode;
          dominantBaWeight = existingBaWeight + weight;
        }
      }
    }
    if (operatorWeights.size === 0) {
      const statewideOperator = FULL_STATE_ORGANIZED_OPERATOR_MAP.get(county.stateAbbrev) ?? null;
      if (statewideOperator !== null) {
        addWeightedOperator(operatorWeights, statewideOperator, 1);
        traditionalCount = 0;
      }
    }
    const dominantOperator = chooseDominantOperator(operatorWeights);
    const dominantBaOperator = resolveOrganizedOperatorFromBalancingAuthority(dominantBaCode);
    const marketStructure = determineCountyMarketStructure({
      operators: dominantBaOperator === null ? [...operatorWeights.keys()] : [dominantBaOperator],
      traditionalCount,
    });
    const balancingAuthority =
      dominantBaCode ??
      (dominantOperator === null
        ? dominantUtilityName
        : (ORGANIZED_OPERATOR_BALANCING_AUTHORITY_CODE_MAP.get(dominantOperator) ?? null));
    const wholesaleOperator =
      dominantOperator ??
      (dominantBaCode === null
        ? dominantUtilityName
        : (baNames.get(dominantBaCode) ?? dominantBaCode));
    const operatorWeatherZone =
      dominantOperator === "ERCOT"
        ? (args.operatorWeatherZoneByCountyFips?.get(county.countyFips) ?? null)
        : null;
    const operatorZone = resolveCountyOperatorZone({
      countyFips: county.countyFips,
      dominantOperator,
      dominantUtilityName,
      operatorWeatherZone,
      operatorLoadZoneByCountyFips: args.operatorLoadZoneByCountyFips,
    });
    records.push({
      balancingAuthority,
      countyFips: county.countyFips,
      loadZone: operatorZone.operatorZoneLabel,
      marketStructure,
      meteoZone: args.meteoZoneByCountyFips?.get(county.countyFips) ?? null,
      operatorWeatherZone,
      operatorZoneConfidence: operatorZone.operatorZoneConfidence,
      operatorZoneLabel: operatorZone.operatorZoneLabel,
      operatorZoneType: operatorZone.operatorZoneType,
      weatherZone: operatorWeatherZone,
      wholesaleOperator,
    });
  }
  return records;
}
function readSppQueueSourceAsOfDate(csvContent) {
  const firstLine = csvContent.split(CSV_LINE_SPLIT_REGEX)[0] ?? "";
  const columns = parseCsvLine(firstLine);
  const value = parseOptionalUsDate(columns[1] ?? null);
  if (value === null) {
    throw new Error("SPP queue CSV is missing a valid Last Updated On date");
  }
  return value;
}
function readCsvRecordField(record, key) {
  return record[key] ?? null;
}
function toSppQueueRawRow(record) {
  return {
    capacity: readCsvRecordField(record, "Capacity"),
    commercialOperationDate: readCsvRecordField(record, "Commercial Operation Date"),
    currentCluster: readCsvRecordField(record, "Current Cluster"),
    dateWithdrawn: readCsvRecordField(record, "Date Withdrawn"),
    fuelType: readCsvRecordField(record, "Fuel Type"),
    generationInterconnectionNumber: readCsvRecordField(
      record,
      "Generation Interconnection Number"
    ),
    generationType: readCsvRecordField(record, "Generation Type"),
    ifsQueueNumber: readCsvRecordField(record, "IFS Queue Number"),
    inServiceDate: readCsvRecordField(record, "In-Service Date"),
    jtiqCommitment: readCsvRecordField(record, "JTIQ Commitment"),
    maxSummerMw: readCsvRecordField(record, "MAX Summer MW"),
    maxWinterMw: readCsvRecordField(record, "MAX Winter MW"),
    nearestTownOrCounty: readCsvRecordField(record, "Nearest Town or County"),
    requestReceived: readCsvRecordField(record, "Request Received"),
    requestedInjectionCapabilityMw: readCsvRecordField(
      record,
      "Requested Maximum Injection Capability (MW)"
    ),
    requestedNetworkResourceDeliverabilityMw: readCsvRecordField(
      record,
      "Requested Network Resource Deliverability (MW)"
    ),
    serviceType: readCsvRecordField(record, "Service Type"),
    stateAbbrev: readCsvRecordField(record, "State"),
    status: readCsvRecordField(record, "Status"),
    substationOrLine: readCsvRecordField(record, "Substation or Line"),
    toAtPoi: readCsvRecordField(record, "TO at POI"),
  };
}
function parseSppQueueRows(csvContent) {
  return parseCsvRecords(csvContent).map(toSppQueueRawRow);
}
function chooseFirstFiniteNumber(values) {
  for (const value of values) {
    const parsed = parseOptionalNumber(value);
    if (parsed !== null && parsed > 0) {
      return roundTo(parsed, 2);
    }
  }
  return null;
}
function inferSppQueueSignedIa(value) {
  const normalized = normalizeDisplayText(value)?.toLowerCase() ?? null;
  if (normalized === null || UNKNOWN_QUEUE_STATUSES.has(normalized)) {
    return null;
  }
  if (normalized.includes("pending")) {
    return false;
  }
  if (
    normalized.includes("executed") ||
    normalized.includes("signed") ||
    normalized.includes("final")
  ) {
    return true;
  }
  return null;
}
function inferSppQueueProjectId(row, rowIndex) {
  const projectId = normalizeDisplayText(row.generationInterconnectionNumber);
  if (projectId !== null) {
    return projectId;
  }
  const ifsQueueNumber = normalizeDisplayText(row.ifsQueueNumber);
  if (ifsQueueNumber !== null) {
    return ifsQueueNumber;
  }
  throw new Error(`SPP queue row ${String(rowIndex + 1)} is missing a project identifier`);
}
function readSppQueueLocationCandidates(row) {
  return dedupeStrings(
    [
      normalizeDisplayText(row.nearestTownOrCounty),
      normalizeDisplayText(row.toAtPoi),
      normalizeDisplayText(row.substationOrLine),
    ].filter((value) => value !== null)
  );
}
function resolveSppQueueCountyForRow(args) {
  const stateAbbrev = normalizeDisplayText(args.row.stateAbbrev);
  const locationName = normalizeDisplayText(args.row.nearestTownOrCounty);
  if (stateAbbrev === null) {
    return {
      countyFips: null,
      stateAbbrev,
      unresolvedLocation: null,
    };
  }
  for (const locationCandidate of readSppQueueLocationCandidates(args.row)) {
    const countyFips = resolveSppQueueCountyFips({
      countyLookup: args.countyLookup,
      locationName: locationCandidate,
      placeCountyLookup: args.placeCountyLookup,
      stateAbbrev,
    });
    if (countyFips !== null) {
      return {
        countyFips,
        stateAbbrev,
        unresolvedLocation: null,
      };
    }
  }
  return {
    countyFips: null,
    stateAbbrev,
    unresolvedLocation: locationName === null ? null : `${stateAbbrev}:${locationName}`,
  };
}
function inferSppQueuePastDue(args) {
  if (args.expectedOperationDate === null) {
    return null;
  }
  const expectedDate = Date.parse(`${args.expectedOperationDate}T00:00:00Z`);
  const effectiveDate = Date.parse(`${args.effectiveDate}T00:00:00Z`);
  const isInactiveStatus = args.queueStatus === "withdrawn" || args.queueStatus === "complete";
  return expectedDate < effectiveDate && !isInactiveStatus;
}
function buildSppQueueDerivedValues(args) {
  const queueDate = parseOptionalUsDate(args.row.requestReceived);
  const expectedOperationDate =
    parseOptionalUsDate(args.row.commercialOperationDate) ??
    parseOptionalUsDate(args.row.inServiceDate);
  const withdrawnDate = parseOptionalUsDate(args.row.dateWithdrawn);
  const signedIa = inferSppQueueSignedIa(args.row.status);
  const queueStatus =
    withdrawnDate === null
      ? normalizeQueueStatus(args.row.status, expectedOperationDate)
      : "withdrawn";
  return {
    capacityMw: chooseFirstFiniteNumber([
      args.row.requestedInjectionCapabilityMw,
      args.row.maxSummerMw,
      args.row.maxWinterMw,
      args.row.capacity,
      args.row.requestedNetworkResourceDeliverabilityMw,
    ]),
    daysInQueueActive: queueDate === null ? null : differenceInDays(queueDate, args.effectiveDate),
    expectedOperationDate,
    isPastDue: inferSppQueuePastDue({
      effectiveDate: args.effectiveDate,
      expectedOperationDate,
      queueStatus,
    }),
    stageGroup: deriveQueueStageGroup({
      nativeStatus: args.row.status,
      queueStatus,
      signedIa,
    }),
    queueDate,
    queueStatus,
    signedIa,
  };
}
function buildSppQueueProjectRecord(args) {
  return {
    countyFips: args.countyFips,
    fuelType:
      normalizeDisplayText(args.row.fuelType) ?? normalizeDisplayText(args.row.generationType),
    latestSourceAsOfDate: args.sourceAsOfDate,
    marketId: "spp",
    nativeStatus: normalizeNativeQueueStatus(args.row.status),
    projectId: args.projectId,
    queueCountyConfidence: args.queueCountyConfidence,
    queuePoiLabel: args.queuePoiLabel,
    queueName: "SPP Active Queue",
    queueResolverType: args.queueResolverType,
    stageGroup: args.derivedValues.stageGroup,
    sourceSystem: "spp_active_queue",
    stateAbbrev: args.stateAbbrev,
  };
}
function buildSppQueueSnapshotRecord(args) {
  return {
    capacityMw: args.derivedValues.capacityMw,
    completionPrior: null,
    countyFips: args.countyFips,
    daysInQueueActive: args.derivedValues.daysInQueueActive,
    expectedOperationDate: args.derivedValues.expectedOperationDate,
    isPastDue: args.derivedValues.isPastDue,
    marketId: "spp",
    nativeStatus: normalizeNativeQueueStatus(args.row.status),
    projectId: args.projectId,
    queueDate: args.derivedValues.queueDate,
    queueStatus: args.derivedValues.queueStatus,
    signedIa: args.derivedValues.signedIa,
    sourceSystem: "spp_active_queue",
    stageGroup: args.derivedValues.stageGroup,
    stateAbbrev: args.stateAbbrev,
    transmissionUpgradeCostUsd: null,
    transmissionUpgradeCount: null,
    withdrawalPrior: null,
  };
}
function buildSppQueueRecords(args) {
  const sourceAsOfDate = readSppQueueSourceAsOfDate(args.csvContent);
  const rows = parseSppQueueRows(args.csvContent);
  const countyResolutions = [];
  const projects = [];
  const snapshots = [];
  const unresolved = [];
  const unresolvedLocations = [];
  for (const [index, row] of rows.entries()) {
    const resolution = resolveSppQueueCountyForRow({
      countyLookup: args.countyLookup,
      placeCountyLookup: args.placeCountyLookup,
      row,
    });
    if (resolution.unresolvedLocation !== null) {
      unresolvedLocations.push(resolution.unresolvedLocation);
    }
    const projectId = `spp:${inferSppQueueProjectId(row, index)}`;
    const queuePoiLabel =
      normalizeDisplayText(row.toAtPoi) ?? normalizeDisplayText(row.substationOrLine);
    const queueCountyResolution = resolveQueueCountyResolution({
      explicitCountyFipsValues: resolution.countyFips === null ? [] : [resolution.countyFips],
      locationValues: readSppQueueLocationCandidates(row),
      lookupMaps: args.countyLookup,
      marketId: "spp",
      placeCountyLookup: args.placeCountyLookup,
      projectId,
      queuePoiLabel,
      sourceLocationLabel: normalizeDisplayText(row.nearestTownOrCounty),
      sourceSystem: "spp_active_queue",
      stateAbbrev: resolution.stateAbbrev,
    });
    const derivedValues = buildSppQueueDerivedValues({
      effectiveDate: args.effectiveDate,
      row,
    });
    countyResolutions.push(...queueCountyResolution.resolutions);
    projects.push(
      buildSppQueueProjectRecord({
        countyFips: queueCountyResolution.countyFips,
        derivedValues,
        projectId,
        queueCountyConfidence: queueCountyResolution.queueCountyConfidence,
        queuePoiLabel,
        queueResolverType: queueCountyResolution.queueResolverType,
        row,
        sourceAsOfDate,
        stateAbbrev: resolution.stateAbbrev,
      })
    );
    snapshots.push(
      buildSppQueueSnapshotRecord({
        countyFips: queueCountyResolution.countyFips,
        derivedValues,
        projectId,
        row,
        stateAbbrev: resolution.stateAbbrev,
      })
    );
    const unresolvedRecord = buildQueueUnresolvedRecord({
      marketId: "spp",
      nativeStatus: normalizeNativeQueueStatus(row.status),
      projectId,
      queueCountyResolution,
      queueName: "SPP Active Queue",
      queuePoiLabel,
      sourceSystem: "spp_active_queue",
      stateAbbrev: resolution.stateAbbrev,
    });
    if (unresolvedRecord !== null) {
      unresolved.push(unresolvedRecord);
    }
  }
  const uniqueUnresolvedLocations = dedupeStrings(unresolvedLocations);
  if (uniqueUnresolvedLocations.length > 0) {
    console.warn(
      `[county-power] SPP queue left ${String(uniqueUnresolvedLocations.length)} unresolved locations; first examples: ${uniqueUnresolvedLocations.slice(0, 10).join(", ")}`
    );
  }
  return {
    countyResolutions,
    projects,
    snapshots,
    sourceAsOfDate,
    unresolved,
  };
}
function buildQueueProjectRecord(args) {
  return {
    countyFips: args.countyFips,
    fuelType: args.fuelType,
    latestSourceAsOfDate: args.sourceAsOfDate,
    marketId: args.marketId,
    nativeStatus: args.nativeStatus ?? null,
    projectId: args.projectId,
    queueCountyConfidence: args.queueCountyConfidence ?? null,
    queuePoiLabel: args.queuePoiLabel ?? null,
    queueName: args.queueName,
    queueResolverType: args.queueResolverType ?? null,
    stageGroup:
      args.stageGroup ??
      deriveQueueStageGroup({
        nativeStatus: args.nativeStatus ?? null,
        queueStatus: args.queueStatus ?? null,
        signedIa: args.signedIa ?? null,
      }),
    sourceSystem: args.sourceSystem,
    stateAbbrev: args.stateAbbrev,
  };
}
function buildQueueUnresolvedRecord(args) {
  if (args.queueCountyResolution.unresolved === null) {
    return null;
  }
  return {
    candidateCountyFips: args.queueCountyResolution.unresolved.candidateCountyFips,
    manualReviewFlag: true,
    marketId: args.marketId,
    nativeStatus: args.nativeStatus ?? null,
    projectId: args.projectId,
    queueName: args.queueName,
    queuePoiLabel: args.queuePoiLabel ?? null,
    rawLocationLabel: args.queueCountyResolution.unresolved.rawLocationLabel,
    sourceSystem: args.sourceSystem,
    stateAbbrev: args.stateAbbrev,
    unresolvedReason: args.queueCountyResolution.unresolved.unresolvedReason,
  };
}
function buildQueueSnapshotRecord(args) {
  let completionPrior = null;
  if (typeof args.completionPrior === "number") {
    completionPrior = args.completionPrior;
  } else if (
    args.queueStatus === "withdrawn" ||
    args.queueStatus === "cancelled" ||
    args.queueStatus === "complete"
  ) {
    completionPrior = 0;
  }
  return {
    capacityMw: args.capacityMw,
    completionPrior,
    countyFips: args.countyFips,
    daysInQueueActive:
      args.queueDate === null ? null : differenceInDays(args.queueDate, args.effectiveDate),
    expectedOperationDate: args.expectedOperationDate,
    isPastDue: inferSppQueuePastDue({
      effectiveDate: args.effectiveDate,
      expectedOperationDate: args.expectedOperationDate,
      queueStatus: args.queueStatus,
    }),
    marketId: args.marketId,
    nativeStatus: args.nativeStatus ?? null,
    projectId: args.projectId,
    queueDate: args.queueDate,
    queueStatus: args.queueStatus,
    signedIa: args.signedIa ?? null,
    sourceSystem: args.sourceSystem,
    stageGroup:
      args.stageGroup ??
      deriveQueueStageGroup({
        nativeStatus: args.nativeStatus ?? null,
        queueStatus: args.queueStatus,
        signedIa: args.signedIa ?? null,
      }),
    stateAbbrev: args.stateAbbrev,
    transmissionUpgradeCostUsd: args.transmissionUpgradeCostUsd ?? null,
    transmissionUpgradeCount: args.transmissionUpgradeCount ?? null,
    withdrawalPrior: args.withdrawalPrior ?? null,
  };
}
function normalizePjmQueueStatus(value) {
  const normalized = normalizeDisplayText(value)?.toLowerCase() ?? null;
  if (normalized === null) {
    return null;
  }
  if (normalized.includes("withdraw")) {
    return "withdrawn";
  }
  if (normalized.includes("suspend")) {
    return "suspended";
  }
  if (normalized.includes("service") || normalized.includes("operation")) {
    return "complete";
  }
  if (normalized.includes("construct")) {
    return "under_construction";
  }
  if (normalized.includes("active")) {
    return "active";
  }
  return collapseWhitespace(normalized.replaceAll("/", " ")).replaceAll(" ", "_");
}
function normalizeMisoQueueStatus(value) {
  const normalized = normalizeDisplayText(value)?.toLowerCase() ?? null;
  if (normalized === null) {
    return null;
  }
  if (normalized.includes("withdraw")) {
    return "withdrawn";
  }
  if (
    normalized.includes("done") ||
    normalized.includes("service") ||
    normalized.includes("complete")
  ) {
    return "complete";
  }
  if (normalized.includes("suspend")) {
    return "suspended";
  }
  if (normalized.includes("active")) {
    return "active";
  }
  return collapseWhitespace(normalized.replaceAll("/", " ")).replaceAll(" ", "_");
}
function normalizeErcotQueueStatus(args) {
  if (args.approvedForSynchronizationDate !== null) {
    return "complete";
  }
  if (args.approvedForEnergizationDate !== null) {
    return "energization_approved";
  }
  if (args.signedIa === true) {
    return "ia_signed";
  }
  const phase = normalizeDisplayText(args.studyPhase)?.toLowerCase() ?? null;
  if (phase === null) {
    return "active";
  }
  if (phase.includes("ia")) {
    return "ia_pending";
  }
  if (phase.includes("fis")) {
    return "study";
  }
  return collapseWhitespace(phase.replaceAll(",", " ")).replaceAll(" ", "_");
}
function inferMisoQueueSignedIa(value) {
  const normalized = normalizeDisplayText(value)?.toLowerCase() ?? null;
  if (normalized === null) {
    return null;
  }
  if (normalized.includes("execut")) {
    return true;
  }
  if (normalized.includes("pend")) {
    return false;
  }
  return null;
}
function inferPjmQueueSignedIa(status) {
  const normalized = normalizeDisplayText(status)?.toLowerCase() ?? null;
  if (normalized === null) {
    return null;
  }
  if (normalized.includes("withdraw")) {
    return false;
  }
  if (
    normalized.includes("construct") ||
    normalized.includes("service") ||
    normalized.includes("operation")
  ) {
    return true;
  }
  return null;
}
async function fetchPjmQueueProjectsXml() {
  const response = await fetchWithTimeout(PJM_QUEUE_XML_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${PJM_QUEUE_XML_URL}: ${String(response.status)} ${response.statusText}`
    );
  }
  return {
    content: await response.text(),
    sourceAsOfDate:
      parseOptionalIsoDate(response.headers.get("last-modified")) ?? toIsoDate(new Date()),
  };
}
function parsePjmQueueProjectNodes(xmlContent) {
  return [...xmlContent.replace(UTF8_BOM_REGEX, "").matchAll(PJM_PROJECT_NODE_REGEX)].map(
    (match) => match[1] ?? ""
  );
}
async function buildPjmQueueRecords(args) {
  const { content, sourceAsOfDate } = await fetchPjmQueueProjectsXml();
  writeTextAtomic(join(args.rawDir, "pjm-planning-queue.xml"), content);
  const countyResolutions = [];
  const projects = [];
  const snapshots = [];
  const unresolved = [];
  for (const projectNode of parsePjmQueueProjectNodes(content)) {
    if (readPjmXmlChildText(projectNode, "ProjectType") !== "Generation Interconnection") {
      continue;
    }
    const projectNumber = readPjmXmlChildText(projectNode, "ProjectNumber");
    if (projectNumber === null) {
      continue;
    }
    const stateAbbrev = normalizeUsStateAbbrev(readPjmXmlChildText(projectNode, "State"));
    const projectId = `pjm:${projectNumber}`;
    const queueCountyResolution = resolveQueueCountyResolution({
      explicitCountyFipsValues: stateAbbrev === "DC" ? ["11001"] : [],
      locationValues: [
        readPjmXmlChildText(projectNode, "County"),
        readPjmXmlChildText(projectNode, "Name"),
        readPjmXmlChildText(projectNode, "CommercialName"),
      ],
      lookupMaps: args.countyLookup,
      marketId: "pjm",
      placeCountyLookup: args.placeCountyLookup,
      projectId,
      queuePoiLabel:
        readPjmXmlChildText(projectNode, "CommercialName") ??
        readPjmXmlChildText(projectNode, "Name"),
      sourceLocationLabel: readPjmXmlChildText(projectNode, "County"),
      sourceSystem: "pjm_planning_queue",
      stateAbbrev,
    });
    countyResolutions.push(...queueCountyResolution.resolutions);
    const status = readPjmXmlChildText(projectNode, "Status");
    const queueStatus = normalizePjmQueueStatus(status);
    const queueDate = parseOptionalUsDate(readPjmXmlChildText(projectNode, "SubmittedDate"));
    const expectedOperationDate = pickLatestDate([
      parseOptionalUsDate(readPjmXmlChildText(projectNode, "ProjectedInServiceDate")),
      parseOptionalUsDate(readPjmXmlChildText(projectNode, "CommercialOperationMilestone")),
      parseOptionalUsDate(readPjmXmlChildText(projectNode, "ActualInServiceDate")),
    ]);
    const capacityMw = chooseFirstFiniteNumber([
      readPjmXmlChildText(projectNode, "MaximumFacilityOutput"),
      readPjmXmlChildText(projectNode, "MWCapacity"),
      readPjmXmlChildText(projectNode, "MWEnergy"),
      readPjmXmlChildText(projectNode, "MWInService"),
    ]);
    projects.push(
      buildQueueProjectRecord({
        countyFips: queueCountyResolution.countyFips,
        fuelType: readPjmXmlChildText(projectNode, "Fuel"),
        marketId: "pjm",
        nativeStatus: normalizeNativeQueueStatus(status),
        projectId,
        queueStatus,
        queueCountyConfidence: queueCountyResolution.queueCountyConfidence,
        queuePoiLabel:
          readPjmXmlChildText(projectNode, "CommercialName") ??
          readPjmXmlChildText(projectNode, "Name"),
        queueName: "PJM Planning Queue",
        queueResolverType: queueCountyResolution.queueResolverType,
        signedIa: inferPjmQueueSignedIa(status),
        sourceAsOfDate,
        sourceSystem: "pjm_planning_queue",
        stateAbbrev,
      })
    );
    snapshots.push(
      buildQueueSnapshotRecord({
        capacityMw,
        countyFips: queueCountyResolution.countyFips,
        effectiveDate: args.effectiveDate,
        expectedOperationDate,
        marketId: "pjm",
        nativeStatus: normalizeNativeQueueStatus(status),
        projectId,
        queueDate,
        queueStatus,
        signedIa: inferPjmQueueSignedIa(status),
        sourceSystem: "pjm_planning_queue",
        stateAbbrev,
      })
    );
    const unresolvedRecord = buildQueueUnresolvedRecord({
      marketId: "pjm",
      nativeStatus: normalizeNativeQueueStatus(status),
      projectId,
      queueCountyResolution,
      queueName: "PJM Planning Queue",
      queuePoiLabel:
        readPjmXmlChildText(projectNode, "CommercialName") ??
        readPjmXmlChildText(projectNode, "Name"),
      sourceSystem: "pjm_planning_queue",
      stateAbbrev,
    });
    if (unresolvedRecord !== null) {
      unresolved.push(unresolvedRecord);
    }
  }
  return {
    countyResolutions,
    projects,
    snapshots,
    sourceAsOfDate,
    unresolved,
  };
}
function resolveMisoQueueCounty(args) {
  const explicitState = normalizeUsStateAbbrev(args.row.state);
  const transmissionOwner = normalizeDisplayText(args.row.transmissionOwner);
  const ownerState =
    transmissionOwner === null ? null : (args.ownerStateMap.get(transmissionOwner) ?? null);
  const stateCandidates = dedupeStrings([explicitState, ownerState]);
  for (const stateCandidate of stateCandidates) {
    const directCounty = resolveCountyFipsFromCountyOrPlaceText({
      lookupMaps: args.countyLookup,
      placeCountyLookup: args.placeCountyLookup,
      stateAbbrev: stateCandidate,
      value: args.row.county,
    });
    if (directCounty !== null) {
      return {
        countyFips: directCounty,
        stateAbbrev: stateCandidate,
      };
    }
    const directLocationCounty = resolveCountyFipsFromLocationName({
      locationName: args.row.poiName,
      lookupMaps: args.countyLookup,
      stateAbbrev: stateCandidate,
    });
    if (directLocationCounty !== null) {
      return {
        countyFips: directLocationCounty,
        stateAbbrev: stateCandidate,
      };
    }
    const placeCounty = resolveCountyFipsFromLocationCandidates({
      locationValues: [args.row.poiName, args.row.county],
      lookupMaps: args.countyLookup,
      placeCountyLookup: args.placeCountyLookup,
      stateAbbrev: stateCandidate,
    });
    if (placeCounty !== null) {
      return {
        countyFips: placeCounty,
        stateAbbrev: stateCandidate,
      };
    }
  }
  return {
    countyFips: null,
    stateAbbrev: explicitState ?? ownerState,
  };
}
async function buildMisoQueueRecords(args) {
  const rows = await fetchJson(MISO_QUEUE_JSON_URL);
  if (!Array.isArray(rows)) {
    throw new Error("Invalid MISO queue payload");
  }
  writeJsonAtomic(join(args.rawDir, "miso-gi-queue.json"), rows);
  const ownerStateMap = buildTransmissionOwnerStateMap(rows);
  const countyResolutions = [];
  const projects = [];
  const snapshots = [];
  const unresolved = [];
  const unresolvedLocations = [];
  const sourceAsOfDate = args.effectiveDate;
  for (const row of rows) {
    if (!isPlainRecord(row)) {
      continue;
    }
    const projectNumber = normalizeDisplayText(row.projectNumber);
    if (projectNumber === null) {
      continue;
    }
    const resolution = resolveMisoQueueCounty({
      countyLookup: args.countyLookup,
      ownerStateMap,
      placeCountyLookup: args.placeCountyLookup,
      row,
    });
    const projectId = `miso:${projectNumber}`;
    const queueCountyResolution = resolveQueueCountyResolution({
      explicitCountyFipsValues: resolution.countyFips === null ? [] : [resolution.countyFips],
      locationValues: [row.county, row.poiName],
      lookupMaps: args.countyLookup,
      marketId: "miso",
      placeCountyLookup: args.placeCountyLookup,
      projectId,
      queuePoiLabel: normalizeDisplayText(row.poiName),
      sourceLocationLabel: normalizeDisplayText(row.county),
      sourceSystem: "miso_gi_queue",
      stateAbbrev: resolution.stateAbbrev,
    });
    countyResolutions.push(...queueCountyResolution.resolutions);
    if (
      queueCountyResolution.countyFips === null &&
      queueCountyResolution.resolutions.length === 0
    ) {
      const unresolvedLocation = [
        normalizeUsStateAbbrev(row.state),
        normalizeDisplayText(row.county),
        normalizeDisplayText(row.poiName),
      ]
        .filter((value) => value !== null)
        .join(":");
      if (unresolvedLocation.length > 0) {
        unresolvedLocations.push(unresolvedLocation);
      }
    }
    const queueDate = parseOptionalIsoDate(row.queueDate);
    const expectedOperationDate = parseOptionalIsoDate(row.inService);
    const queueStatus = normalizeMisoQueueStatus(row.applicationStatus);
    const capacityMw = chooseFirstFiniteNumber([
      row.summerNetMW,
      row.winterNetMW,
      row.dp2NrisMw,
      row.dp1NrisMw,
      row.dp2ErisMw,
      row.dp1ErisMw,
    ]);
    projects.push(
      buildQueueProjectRecord({
        countyFips: queueCountyResolution.countyFips,
        fuelType: normalizeDisplayText(row.fuelType) ?? normalizeDisplayText(row.facilityType),
        marketId: "miso",
        nativeStatus: normalizeNativeQueueStatus(row.applicationStatus),
        projectId,
        queueStatus,
        queueCountyConfidence: queueCountyResolution.queueCountyConfidence,
        queuePoiLabel: normalizeDisplayText(row.poiName),
        queueName: "MISO Generator Interconnection Queue",
        queueResolverType: queueCountyResolution.queueResolverType,
        signedIa: inferMisoQueueSignedIa(row.postGIAStatus),
        sourceAsOfDate,
        sourceSystem: "miso_gi_queue",
        stateAbbrev: resolution.stateAbbrev,
      })
    );
    snapshots.push(
      buildQueueSnapshotRecord({
        capacityMw,
        countyFips: queueCountyResolution.countyFips,
        effectiveDate: args.effectiveDate,
        expectedOperationDate,
        marketId: "miso",
        nativeStatus: normalizeNativeQueueStatus(row.applicationStatus),
        projectId,
        queueDate,
        queueStatus,
        signedIa: inferMisoQueueSignedIa(row.postGIAStatus),
        sourceSystem: "miso_gi_queue",
        stateAbbrev: resolution.stateAbbrev,
      })
    );
    const unresolvedRecord = buildQueueUnresolvedRecord({
      marketId: "miso",
      nativeStatus: normalizeNativeQueueStatus(row.applicationStatus),
      projectId,
      queueCountyResolution,
      queueName: "MISO Generator Interconnection Queue",
      queuePoiLabel: normalizeDisplayText(row.poiName),
      sourceSystem: "miso_gi_queue",
      stateAbbrev: resolution.stateAbbrev,
    });
    if (unresolvedRecord !== null) {
      unresolved.push(unresolvedRecord);
    }
  }
  const uniqueUnresolvedLocations = dedupeStrings(unresolvedLocations);
  if (uniqueUnresolvedLocations.length > 0) {
    console.warn(
      `[county-power] MISO queue left ${String(uniqueUnresolvedLocations.length)} unresolved county mappings; first examples: ${uniqueUnresolvedLocations.slice(0, 10).join(", ")}`
    );
  }
  return {
    countyResolutions,
    projects,
    snapshots,
    sourceAsOfDate,
    unresolved,
  };
}
async function fetchErcotReportList(reportTypeId) {
  const payload = await fetchJson(
    `${ERCOT_MIS_LIST_URL}?${new URLSearchParams({
      reportTypeId: String(reportTypeId),
    }).toString()}`
  );
  const documentList = payload?.ListDocsByRptTypeRes?.DocumentList;
  if (!Array.isArray(documentList)) {
    throw new Error(`Invalid ERCOT report listing for report type ${String(reportTypeId)}`);
  }
  return documentList
    .map((entry) => (isPlainRecord(entry) && isPlainRecord(entry.Document) ? entry.Document : null))
    .filter((entry) => entry !== null);
}
function selectLatestErcotDocument(documents, friendlyNamePrefix) {
  let selectedDocument = null;
  let selectedPublishDate = Number.NEGATIVE_INFINITY;
  for (const document of documents) {
    const friendlyName = normalizeDisplayText(document.FriendlyName);
    const docId = normalizeDisplayText(document.DocID);
    const publishDate = normalizeDisplayText(document.PublishDate);
    if (
      friendlyName === null ||
      docId === null ||
      publishDate === null ||
      !friendlyName.startsWith(friendlyNamePrefix)
    ) {
      continue;
    }
    const parsedPublishDate = Date.parse(publishDate);
    if (!Number.isFinite(parsedPublishDate) || parsedPublishDate <= selectedPublishDate) {
      continue;
    }
    selectedDocument = {
      docId,
      publishDate,
    };
    selectedPublishDate = parsedPublishDate;
  }
  if (selectedDocument === null) {
    throw new Error(`Unable to locate ERCOT document for ${friendlyNamePrefix}`);
  }
  return selectedDocument;
}
function readWorksheetRows(workbookPath, sheetName) {
  const workbook = readFile(workbookPath, {
    cellDates: false,
    dense: true,
    raw: false,
  });
  const worksheet =
    workbook.Sheets[sheetName] ??
    workbook.Sheets[
      workbook.SheetNames.find(
        (candidateName) =>
          collapseWhitespace(candidateName).toLowerCase() ===
          collapseWhitespace(sheetName).toLowerCase()
      ) ?? ""
    ];
  if (typeof worksheet === "undefined") {
    throw new Error(`Missing worksheet "${sheetName}" in ${workbookPath}`);
  }
  return utils.sheet_to_json(worksheet, {
    blankrows: false,
    defval: null,
    header: 1,
    raw: false,
  });
}
function readWorksheetRecordRows(rows, headerRowIndex, firstDataRowIndex) {
  const headerRow = rows[headerRowIndex] ?? [];
  const headers = headerRow.map(
    (value, index) => normalizeDisplayText(value) ?? `column_${String(index + 1)}`
  );
  return rows.slice(firstDataRowIndex).map((row) =>
    headers.reduce((record, header, index) => {
      record[header] = normalizeDisplayText(row[index]);
      return record;
    }, {})
  );
}
function buildErcotQueueWorkbookPeriod(workbookPath) {
  const rows = readWorksheetRows(workbookPath, "Contents");
  const rawPeriod = normalizeDisplayText(rows[0]?.[0]);
  const match = rawPeriod === null ? null : rawPeriod.match(ERCOT_PERIOD_RANGE_REGEX);
  if (match === null) {
    return null;
  }
  return parseWrittenMonthDate(match[4] ?? "", match[5] ?? "", match[6] ?? "");
}
function buildErcotQueueRows(workbookPath) {
  const largeRows = readWorksheetRecordRows(
    readWorksheetRows(workbookPath, "Project Details - Large Gen"),
    15,
    20
  );
  const smallRows = readWorksheetRecordRows(
    readWorksheetRows(workbookPath, "Project Details - Small Gen"),
    5,
    8
  );
  return {
    largeRows,
    smallRows,
  };
}
function buildErcotQueueRecord(args) {
  const projectId = `ercot:${args.inr}`;
  const countyFips = resolveCountyFipsFromCountyName({
    countyName: args.row.County,
    lookupMaps: args.countyLookup,
    stateAbbrev: "TX",
  });
  const queueCountyResolution = resolveQueueCountyResolution({
    explicitCountyFipsValues: countyFips === null ? [] : [countyFips],
    locationValues: [args.row.County],
    lookupMaps: args.countyLookup,
    marketId: "ercot",
    placeCountyLookup: new Map(),
    projectId,
    queuePoiLabel: null,
    sourceLocationLabel: normalizeDisplayText(args.row.County),
    sourceSystem: "ercot_gis_report",
    stateAbbrev: "TX",
  });
  const queueDate =
    args.queueType === "large"
      ? pickLatestDate([
          parseOptionalUsDate(args.row["Screening Study Started"]),
          parseOptionalUsDate(args.row["FIS Requested"]),
        ])
      : parseOptionalUsDate(args.row["Model Ready Date"]);
  const expectedOperationDate = parseOptionalUsDate(args.row["Projected COD"]);
  const approvedForEnergizationDate = parseOptionalUsDate(args.row["Approved for Energization"]);
  const approvedForSynchronizationDate = parseOptionalUsDate(
    args.row["Approved for Synchronization"]
  );
  const signedIa = normalizeTruthyFlag(args.row["IA Signed"]);
  const queueStatus = normalizeErcotQueueStatus({
    approvedForEnergizationDate,
    approvedForSynchronizationDate,
    signedIa,
    studyPhase: args.row["GIM Study Phase"],
  });
  const fuelType = [args.row.Fuel, args.row.Technology].filter((value) => value !== null).join(" ");
  return {
    countyResolutions: queueCountyResolution.resolutions,
    project: buildQueueProjectRecord({
      countyFips: queueCountyResolution.countyFips,
      fuelType: fuelType.length === 0 ? null : fuelType,
      marketId: "ercot",
      nativeStatus: normalizeNativeQueueStatus(args.row["GIM Study Phase"]),
      projectId,
      queueStatus,
      queueCountyConfidence: queueCountyResolution.queueCountyConfidence,
      queuePoiLabel: null,
      queueName: "ERCOT GIS Report",
      queueResolverType: queueCountyResolution.queueResolverType,
      sourceAsOfDate: args.sourceAsOfDate,
      sourceSystem: "ercot_gis_report",
      stateAbbrev: "TX",
    }),
    snapshot: buildQueueSnapshotRecord({
      capacityMw: parseOptionalNumber(args.row["Capacity (MW)"]),
      countyFips: queueCountyResolution.countyFips,
      effectiveDate: args.effectiveDate,
      expectedOperationDate,
      marketId: "ercot",
      nativeStatus: normalizeNativeQueueStatus(args.row["GIM Study Phase"]),
      projectId,
      queueDate,
      queueStatus,
      signedIa,
      sourceSystem: "ercot_gis_report",
      stateAbbrev: "TX",
    }),
    unresolved: buildQueueUnresolvedRecord({
      marketId: "ercot",
      nativeStatus: normalizeNativeQueueStatus(args.row["GIM Study Phase"]),
      projectId,
      queueCountyResolution,
      queueName: "ERCOT GIS Report",
      queuePoiLabel: null,
      sourceSystem: "ercot_gis_report",
      stateAbbrev: "TX",
    }),
  };
}
async function buildErcotQueueRecords(args) {
  const documents = await fetchErcotReportList(ERCOT_GIS_REPORT_TYPE_ID);
  const latestDocument = selectLatestErcotDocument(documents, "GIS_Report_");
  const workbookPath = join(args.rawDir, "ercot-gis-report.xlsx");
  await downloadFile(
    `${ERCOT_MIS_DOWNLOAD_URL}?${new URLSearchParams({
      doclookupId: latestDocument.docId,
    }).toString()}`,
    workbookPath
  );
  const sourceAsOfDate =
    buildErcotQueueWorkbookPeriod(workbookPath) ??
    parseOptionalIsoDate(latestDocument.publishDate) ??
    args.effectiveDate;
  const { largeRows, smallRows } = buildErcotQueueRows(workbookPath);
  const countyResolutions = [];
  const projects = [];
  const snapshots = [];
  const unresolved = [];
  for (const row of [...largeRows, ...smallRows]) {
    if (!isPlainRecord(row)) {
      continue;
    }
    const inr = normalizeDisplayText(row.INR);
    if (inr === null) {
      continue;
    }
    const record = buildErcotQueueRecord({
      countyLookup: args.countyLookup,
      effectiveDate: args.effectiveDate,
      inr,
      queueType: largeRows.includes(row) ? "large" : "small",
      row,
      sourceAsOfDate,
    });
    countyResolutions.push(...record.countyResolutions);
    projects.push(record.project);
    snapshots.push(record.snapshot);
    if (record.unresolved !== null) {
      unresolved.push(record.unresolved);
    }
  }
  return {
    countyResolutions,
    projects,
    snapshots,
    sourceAsOfDate,
    unresolved,
  };
}
function readWorkbookReportRunDate(rows) {
  for (const row of rows) {
    for (const value of row) {
      const normalized = normalizeDisplayText(value);
      if (normalized === null) {
        continue;
      }
      const match = normalized.match(CAISO_QUEUE_REPORT_RUN_DATE_PATTERN);
      if (match !== null) {
        return parseOptionalUsDate(match[1] ?? null);
      }
    }
  }
  return null;
}
async function resolveCaisoQueueWorkbookUrl() {
  return resolveLinkedDocumentUrl({
    html: await fetchText(CAISO_PUBLIC_QUEUE_REPORT_PAGE_URL),
    notFoundMessage: "Unable to locate the CAISO public queue workbook URL",
    pageUrl: CAISO_PUBLIC_QUEUE_REPORT_PAGE_URL,
    pattern: CAISO_PUBLIC_QUEUE_WORKBOOK_URL_PATTERN,
  });
}
function normalizeCaisoQueueFuelType(record) {
  return dedupeStrings(
    [
      record["Type-1"],
      record["Type-2"],
      record["Type-3"],
      record["Fuel-1"],
      record["Fuel-2"],
      record["Fuel-3"],
    ]
      .map((value) => normalizeDisplayText(value))
      .filter((value) => value !== null)
  ).join(" ");
}
function buildCaisoQueueRecord(args) {
  const projectName = normalizeDisplayText(args.record["Project Name"]);
  const queuePosition = normalizeDisplayText(args.record["Queue Position"]);
  if (projectName === null || queuePosition === null) {
    return null;
  }
  const stateAbbrev = normalizeUsStateAbbrev(args.record.State) ?? "CA";
  const countyName = normalizeDisplayText(args.record.County);
  const projectId = `caiso:${queuePosition}`;
  const queuePoiLabel = normalizeDisplayText(args.record["Station or Transmission Line"]);
  const queueCountyResolution = resolveQueueCountyResolution({
    locationValues: [countyName, args.record["Station or Transmission Line"], projectName],
    lookupMaps: args.countyLookup,
    marketId: "caiso",
    placeCountyLookup: args.placeCountyLookup,
    projectId,
    queuePoiLabel,
    sourceLocationLabel: countyName,
    sourceSystem: "caiso_public_queue",
    stateAbbrev,
  });
  const queueDate =
    parseOptionalUsLikeDate(args.record["Queue Date"]) ??
    parseOptionalUsLikeDate(args.record["Interconnection Request Receive Date"]);
  const applicationStatus =
    normalizeDisplayText(args.record["Application Status"])?.toLowerCase() ?? null;
  const currentOnlineDate =
    parseOptionalUsLikeDate(args.record["Current On-line Date"]) ??
    parseOptionalUsLikeDate(args.record["Actual On-line Date"]);
  const expectedOperationDate =
    currentOnlineDate ??
    parseOptionalUsLikeDate(args.record["Proposed On-line Date (as filed with IR)"]);
  let queueStatus = normalizeQueueStatus(applicationStatus, expectedOperationDate);
  if (args.sheetStatus === "withdrawn") {
    queueStatus = "withdrawn";
  } else if (args.sheetStatus === "complete" || applicationStatus === "completed") {
    queueStatus = "complete";
  }
  return {
    countyFips: queueCountyResolution.countyFips,
    countyResolutions: queueCountyResolution.resolutions,
    loadZone:
      normalizeDisplayText(args.record["PTO Study Region"]) ??
      normalizeDisplayText(args.record.Utility),
    project: buildQueueProjectRecord({
      countyFips: queueCountyResolution.countyFips,
      fuelType: normalizeCaisoQueueFuelType(args.record),
      marketId: "caiso",
      nativeStatus: normalizeNativeQueueStatus(args.record["Application Status"]),
      projectId,
      queueStatus,
      queueCountyConfidence: queueCountyResolution.queueCountyConfidence,
      queuePoiLabel,
      queueName: "CAISO Public Queue Report",
      queueResolverType: queueCountyResolution.queueResolverType,
      sourceAsOfDate: args.sourceAsOfDate,
      sourceSystem: "caiso_public_queue",
      stateAbbrev,
    }),
    snapshot: buildQueueSnapshotRecord({
      capacityMw: chooseFirstFiniteNumber([
        args.record["Net MWs to Grid"],
        args.record["MW-1"],
        args.record["MW-2"],
        args.record["MW-3"],
      ]),
      completionPrior: queueStatus === "complete" || queueStatus === "withdrawn" ? 0 : null,
      countyFips: queueCountyResolution.countyFips,
      effectiveDate: args.effectiveDate,
      expectedOperationDate,
      marketId: "caiso",
      nativeStatus: normalizeNativeQueueStatus(args.record["Application Status"]),
      projectId,
      queueDate,
      queueStatus,
      signedIa:
        normalizeDisplayText(args.record["Interconnection Agreement Status"]) === "Executed",
      sourceSystem: "caiso_public_queue",
      stateAbbrev,
      withdrawalPrior: null,
    }),
    unresolved: buildQueueUnresolvedRecord({
      marketId: "caiso",
      nativeStatus: normalizeNativeQueueStatus(args.record["Application Status"]),
      projectId,
      queueCountyResolution,
      queueName: "CAISO Public Queue Report",
      queuePoiLabel,
      sourceSystem: "caiso_public_queue",
      stateAbbrev,
    }),
  };
}
async function buildCaisoQueueRecords(args) {
  const workbookUrl = await resolveCaisoQueueWorkbookUrl();
  const workbookPath = join(args.rawDir, "caiso-public-queue-report.xlsx");
  await downloadFile(workbookUrl, workbookPath);
  const activeRows = readWorksheetRows(workbookPath, "Grid GenerationQueue");
  const completedRows = readWorksheetRows(workbookPath, "Completed Generation Projects");
  const withdrawnRows = readWorksheetRows(workbookPath, "Withdrawn Generation Projects");
  const sourceAsOfDate =
    readWorkbookReportRunDate(activeRows) ??
    readWorkbookReportRunDate(completedRows) ??
    readWorkbookReportRunDate(withdrawnRows) ??
    args.effectiveDate;
  const records = [
    ...readWorksheetRecordsByHeaders({
      context: "CAISO active queue",
      expectedHeaders: ["Project Name", "Queue Position", "Application Status", "County", "State"],
      rows: activeRows,
    }).map((record) =>
      buildCaisoQueueRecord({
        countyLookup: args.countyLookup,
        effectiveDate: args.effectiveDate,
        placeCountyLookup: args.placeCountyLookup,
        record,
        sheetStatus: "active",
        sourceAsOfDate,
      })
    ),
    ...readWorksheetRecordsByHeaders({
      context: "CAISO completed queue",
      expectedHeaders: ["Project Name", "Queue Position", "Application Status", "County", "State"],
      rows: completedRows,
    }).map((record) =>
      buildCaisoQueueRecord({
        countyLookup: args.countyLookup,
        effectiveDate: args.effectiveDate,
        placeCountyLookup: args.placeCountyLookup,
        record,
        sheetStatus: "complete",
        sourceAsOfDate,
      })
    ),
    ...readWorksheetRecordsByHeaders({
      context: "CAISO withdrawn queue",
      expectedHeaders: [
        "Project Name - Confidential",
        "Queue Position",
        "Application Status",
        "County",
        "State",
      ],
      rows: withdrawnRows,
    }).map((record) =>
      buildCaisoQueueRecord({
        countyLookup: args.countyLookup,
        effectiveDate: args.effectiveDate,
        placeCountyLookup: args.placeCountyLookup,
        record: {
          ...record,
          "Project Name": record["Project Name - Confidential"],
        },
        sheetStatus: "withdrawn",
        sourceAsOfDate,
      })
    ),
  ].filter((record) => record !== null);
  return {
    countyLoadZones: buildDominantCountyTextMap(buildCountyTextEntriesFromQueueRecords(records)),
    countyResolutions: dedupeJsonRows(records.flatMap((record) => record.countyResolutions)),
    projects: dedupeJsonRows(records.map((record) => record.project)),
    snapshots: dedupeJsonRows(records.map((record) => record.snapshot)),
    sourceAsOfDate,
    unresolved: dedupeJsonRows(
      records.map((record) => record.unresolved ?? null).filter((record) => record !== null)
    ),
  };
}
async function resolveNyisoQueueWorkbookUrl() {
  return resolveLinkedDocumentUrl({
    html: await fetchText(NYISO_QUEUE_SOURCE_PAGE_URL),
    notFoundMessage: "Unable to locate the NYISO interconnection queue workbook URL",
    pageUrl: NYISO_QUEUE_SOURCE_PAGE_URL,
    pattern: NYISO_QUEUE_WORKBOOK_URL_PATTERN,
  });
}
function normalizeNyisoCountyName(value) {
  const normalized = normalizeDisplayText(value);
  if (normalized === null) {
    return null;
  }
  const upperValue = normalized.toUpperCase();
  if (upperValue === "NY") {
    return "New York";
  }
  const countySuffixMatch = upperValue.match(NYISO_COUNTY_SUFFIX_STATE_REGEX);
  if (countySuffixMatch !== null) {
    return normalizeNyisoCountyName(countySuffixMatch[1] ?? null);
  }
  const alias = NYISO_COUNTY_ALIAS_MAP.get(upperValue) ?? null;
  if (alias !== null) {
    return alias;
  }
  return normalized;
}
function buildDominantCountyTextMap(entries) {
  const countyValueCounts = new Map();
  for (const entry of entries) {
    const countyCounts = countyValueCounts.get(entry.countyFips) ?? new Map();
    countyCounts.set(entry.value, (countyCounts.get(entry.value) ?? 0) + 1);
    countyValueCounts.set(entry.countyFips, countyCounts);
  }
  const result = new Map();
  for (const [countyFips, valueCounts] of countyValueCounts.entries()) {
    let bestValue = null;
    let bestCount = Number.NEGATIVE_INFINITY;
    let tied = false;
    for (const [value, count] of valueCounts.entries()) {
      if (count > bestCount) {
        bestValue = value;
        bestCount = count;
        tied = false;
        continue;
      }
      if (count === bestCount) {
        tied = true;
      }
    }
    result.set(countyFips, tied ? null : bestValue);
  }
  return result;
}
function buildWeightedCountyTextMap(entries) {
  const countyValueWeights = new Map();
  for (const entry of entries) {
    const countyWeights = countyValueWeights.get(entry.countyFips) ?? new Map();
    countyWeights.set(entry.value, (countyWeights.get(entry.value) ?? 0) + entry.weight);
    countyValueWeights.set(entry.countyFips, countyWeights);
  }
  const result = new Map();
  for (const [countyFips, valueWeights] of countyValueWeights.entries()) {
    let bestValue = null;
    let bestWeight = Number.NEGATIVE_INFINITY;
    let tied = false;
    for (const [value, weight] of valueWeights.entries()) {
      if (weight > bestWeight) {
        bestValue = value;
        bestWeight = weight;
        tied = false;
        continue;
      }
      if (weight === bestWeight) {
        tied = true;
      }
    }
    result.set(countyFips, tied ? null : bestValue);
  }
  return result;
}
function buildJoinedCountyTextMap(entries) {
  const countyValues = new Map();
  for (const entry of entries) {
    const existingValues = countyValues.get(entry.countyFips) ?? new Set();
    existingValues.add(entry.value);
    countyValues.set(entry.countyFips, existingValues);
  }
  return new Map(
    [...countyValues.entries()].map(([countyFips, values]) => [
      countyFips,
      [...values].sort((left, right) => left.localeCompare(right)).join(" / "),
    ])
  );
}
function buildCountyTextEntriesFromQueueRecords(records) {
  return records.flatMap((record) => {
    if (record.loadZone === null) {
      return [];
    }
    if (Array.isArray(record.countyResolutions) && record.countyResolutions.length > 0) {
      return record.countyResolutions.map((resolution) => ({
        countyFips: resolution.countyFips,
        value: record.loadZone,
      }));
    }
    if (record.countyFips === null) {
      return [];
    }
    return [
      {
        countyFips: record.countyFips,
        value: record.loadZone,
      },
    ];
  });
}
function buildMisoLocalResourceZoneByCountyFips(countyEntries) {
  return new Map(
    countyEntries
      .map((county) => {
        const localResourceZone = MISO_LOCAL_RESOURCE_ZONE_BY_STATE.get(county.stateAbbrev) ?? null;
        if (localResourceZone === null) {
          return null;
        }
        return [county.countyFips, localResourceZone];
      })
      .filter((entry) => entry !== null)
  );
}
function inferOperatorZoneResolutionMethod(record) {
  if (record.operatorZoneType === "queue_study_region" || record.operatorZoneType === "load_zone") {
    return "operator_queue_row";
  }
  if (record.operatorZoneType === "local_resource_zone") {
    return "official_operator_reference";
  }
  if (record.operatorZoneType === "settlement_location") {
    return "operator_market_map";
  }
  if (record.operatorZoneType === "weather_zone") {
    return "operator_weather_zone";
  }
  if (record.operatorZoneType === "utility_zone_proxy") {
    return "public_proxy";
  }
  return "derived";
}
function inferOperatorZoneConfidenceClass(record) {
  const resolutionMethod = inferOperatorZoneResolutionMethod(record);
  if (
    resolutionMethod === "official_operator_reference" ||
    resolutionMethod === "operator_queue_row" ||
    resolutionMethod === "operator_market_map" ||
    resolutionMethod === "operator_weather_zone"
  ) {
    return "official";
  }
  if (resolutionMethod === "public_proxy" || resolutionMethod === "derived") {
    return "derived";
  }
  return "unknown";
}
function inferOperatorZoneSourceArtifact(record) {
  if (record.wholesaleOperator === "ERCOT" && record.operatorZoneType === "weather_zone") {
    return "ercot-appendix-d-profile-decision-tree";
  }
  if (record.wholesaleOperator === "CAISO" && record.operatorZoneType === "queue_study_region") {
    return "caiso-public-queue-report";
  }
  if (record.wholesaleOperator === "ISO-NE" && record.operatorZoneType === "load_zone") {
    return "iso-ne-public-queue";
  }
  if (record.wholesaleOperator === "NYISO" && record.operatorZoneType === "load_zone") {
    return "nyiso-interconnection-queue";
  }
  if (record.wholesaleOperator === "MISO" && record.operatorZoneType === "local_resource_zone") {
    return "miso-lrz-boundaries";
  }
  if (record.wholesaleOperator === "SPP" && record.operatorZoneType === "settlement_location") {
    return "spp-settlement-location";
  }
  if (record.wholesaleOperator === "PJM" && record.operatorZoneType === "utility_zone_proxy") {
    return "pjm-utility-zone-proxy";
  }
  return "county-power-public-us";
}
function inferOperatorRegionMappingMethod(record) {
  if (record.marketStructure === "organized_market") {
    return "organized_market_assignment";
  }
  if (record.balancingAuthority !== null) {
    return "balancing_authority_rollup";
  }
  return "service_territory_rollup";
}
function inferOperatorRegionConfidenceClass(record) {
  if (record.marketStructure === "organized_market") {
    return "official";
  }
  if (record.wholesaleOperator !== null) {
    return "derived";
  }
  return "unknown";
}
function buildCountyPowerContextByCountyFips(powerMarketRecords) {
  return new Map(powerMarketRecords.map((record) => [record.countyFips, record]));
}
function buildOperatorRegionRecords(powerMarketRecords) {
  const recordByRegion = new Map();
  for (const record of powerMarketRecords) {
    if (record.wholesaleOperator === null) {
      continue;
    }
    const existing = recordByRegion.get(record.wholesaleOperator) ?? null;
    const nextRecord = {
      confidenceClass: inferOperatorRegionConfidenceClass(record),
      mappingMethod: inferOperatorRegionMappingMethod(record),
      marketStructure: record.marketStructure,
      operatorRegion: record.wholesaleOperator,
      owner: "county-power-public-us",
      sourceArtifact: "public-us-county-power-market-context",
      sourceVersion: null,
    };
    if (existing === null) {
      recordByRegion.set(record.wholesaleOperator, nextRecord);
      continue;
    }
    recordByRegion.set(record.wholesaleOperator, {
      ...existing,
      confidenceClass:
        existing.confidenceClass === "official"
          ? existing.confidenceClass
          : nextRecord.confidenceClass,
      marketStructure:
        existing.marketStructure === "organized_market"
          ? existing.marketStructure
          : nextRecord.marketStructure,
    });
  }
  return [...recordByRegion.values()].sort((left, right) =>
    left.operatorRegion.localeCompare(right.operatorRegion)
  );
}
function buildCountyOperatorRegionBridgeRecords(powerMarketRecords) {
  return powerMarketRecords.flatMap((record) => {
    if (record.wholesaleOperator === null) {
      return [];
    }
    return [
      {
        allocationShare: 1,
        confidenceClass: inferOperatorRegionConfidenceClass(record),
        countyFips: record.countyFips,
        isBorderCounty: false,
        isPrimaryRegion: true,
        isSeamCounty: false,
        mappingMethod: inferOperatorRegionMappingMethod(record),
        marketStructure: record.marketStructure,
        operatorRegion: record.wholesaleOperator,
        owner: "county-power-public-us",
        sourceArtifact: "public-us-county-power-market-context",
        sourceVersion: null,
      },
    ];
  });
}
function buildCountyOperatorZoneBridgeRecords(powerMarketRecords) {
  return powerMarketRecords.flatMap((record) => {
    if (
      record.wholesaleOperator === null ||
      record.operatorZoneLabel === null ||
      record.operatorZoneType === null
    ) {
      return [];
    }
    return [
      {
        allocationShare: 1,
        countyFips: record.countyFips,
        confidenceClass: inferOperatorZoneConfidenceClass(record),
        isPrimarySubregion: true,
        operator: record.wholesaleOperator,
        owner: "county-power-public-us",
        operatorZoneConfidence: record.operatorZoneConfidence,
        operatorZoneLabel: record.operatorZoneLabel,
        operatorZoneType: record.operatorZoneType,
        resolutionMethod: inferOperatorZoneResolutionMethod(record),
        sourceArtifact: inferOperatorZoneSourceArtifact(record),
        sourceVersion: null,
      },
    ];
  });
}
function buildQueuePoiReferenceRecord(project, countyContext, queuePoiLabel) {
  return {
    countyFips: project.countyFips,
    operator: countyContext?.wholesaleOperator ?? null,
    operatorZoneLabel: countyContext?.operatorZoneLabel ?? null,
    operatorZoneType: countyContext?.operatorZoneType ?? null,
    queuePoiLabel,
    resolutionMethod: project.queueResolverType ?? "direct_county_match",
    resolverConfidence: project.queueCountyConfidence ?? "medium",
    sourceSystem: project.sourceSystem,
    stateAbbrev: project.stateAbbrev,
  };
}
function mergeQueuePoiReferenceRecord(existingRecord, nextRecord) {
  return {
    countyFips: existingRecord.countyFips,
    operator: existingRecord.operator ?? nextRecord.operator,
    operatorZoneLabel: existingRecord.operatorZoneLabel ?? nextRecord.operatorZoneLabel,
    operatorZoneType: existingRecord.operatorZoneType ?? nextRecord.operatorZoneType,
    queuePoiLabel: existingRecord.queuePoiLabel,
    resolutionMethod:
      existingRecord.resolutionMethod === "direct_county_match"
        ? existingRecord.resolutionMethod
        : nextRecord.resolutionMethod,
    resolverConfidence:
      existingRecord.resolverConfidence === "high" ? "high" : nextRecord.resolverConfidence,
    sourceSystem: existingRecord.sourceSystem,
    stateAbbrev: existingRecord.stateAbbrev ?? nextRecord.stateAbbrev,
  };
}
function buildOperatorZoneReferenceRecords(args) {
  const countyByFips = new Map(args.countyEntries.map((county) => [county.countyFips, county]));
  const recordByKey = new Map();
  for (const countyZone of args.countyOperatorZones) {
    const county = countyByFips.get(countyZone.countyFips);
    const key = [
      countyZone.operator,
      countyZone.operatorZoneLabel,
      countyZone.operatorZoneType,
    ].join("|");
    const existingRecord = recordByKey.get(key) ?? null;
    const nextRecord = {
      confidenceClass: countyZone.confidenceClass,
      operator: countyZone.operator,
      owner: countyZone.owner,
      operatorZoneConfidence: countyZone.operatorZoneConfidence,
      operatorZoneLabel: countyZone.operatorZoneLabel,
      operatorZoneType: countyZone.operatorZoneType,
      referenceName: countyZone.operatorZoneLabel,
      resolutionMethod: countyZone.resolutionMethod,
      sourceArtifact: countyZone.sourceArtifact,
      sourceVersion: countyZone.sourceVersion,
      stateAbbrev: county?.stateAbbrev ?? null,
    };
    if (existingRecord === null) {
      recordByKey.set(key, nextRecord);
      continue;
    }
    recordByKey.set(key, {
      confidenceClass:
        existingRecord.confidenceClass === "official"
          ? existingRecord.confidenceClass
          : nextRecord.confidenceClass,
      operator: existingRecord.operator,
      owner: existingRecord.owner,
      operatorZoneConfidence:
        existingRecord.operatorZoneConfidence ?? nextRecord.operatorZoneConfidence,
      operatorZoneLabel: existingRecord.operatorZoneLabel,
      operatorZoneType: existingRecord.operatorZoneType,
      referenceName: existingRecord.referenceName,
      resolutionMethod:
        existingRecord.resolutionMethod === "official_operator_reference"
          ? existingRecord.resolutionMethod
          : nextRecord.resolutionMethod,
      sourceArtifact: existingRecord.sourceArtifact ?? nextRecord.sourceArtifact,
      sourceVersion: existingRecord.sourceVersion ?? nextRecord.sourceVersion,
      stateAbbrev: existingRecord.stateAbbrev ?? nextRecord.stateAbbrev,
    });
  }
  return [...recordByKey.values()].sort((left, right) => {
    const leftKey = `${left.operator}:${left.operatorZoneLabel}:${left.stateAbbrev ?? ""}`;
    const rightKey = `${right.operator}:${right.operatorZoneLabel}:${right.stateAbbrev ?? ""}`;
    return leftKey.localeCompare(rightKey);
  });
}
function buildQueueResolutionOverrideRecords(args) {
  return [...SPP_QUEUE_LOCATION_OVERRIDES.entries()]
    .map(([locationKey, override]) => {
      const countyFips = resolveCountyFipsFromCountyName({
        countyName: override.countyName,
        lookupMaps: args.countyLookup,
        stateAbbrev: override.stateAbbrev,
      });
      if (countyFips === null) {
        return null;
      }
      const [stateAbbrev = "", matcherValue = ""] = locationKey.split("|");
      return {
        allocationShare: 1,
        countyFips,
        matcherType: "source_location_label",
        matcherValue,
        notes: "SPP public queue manual override",
        resolverConfidence: "high",
        resolverType: "manual_override",
        sourceSystem: "spp_active_queue",
        stateAbbrev,
      };
    })
    .filter((record) => record !== null)
    .sort((left, right) => {
      const leftKey = `${left.sourceSystem}:${left.stateAbbrev ?? ""}:${left.matcherValue}`;
      const rightKey = `${right.sourceSystem}:${right.stateAbbrev ?? ""}:${right.matcherValue}`;
      return leftKey.localeCompare(rightKey);
    });
}
function buildQueuePoiReferenceSeedMap(args) {
  const resolutionByProjectId = new Map();
  for (const resolution of args.queueCountyResolutions) {
    const existing = resolutionByProjectId.get(resolution.projectId) ?? [];
    existing.push(resolution);
    resolutionByProjectId.set(resolution.projectId, existing);
  }
  const countyFipsByPoiKey = new Map();
  for (const project of args.queueProjects) {
    const queuePoiLabel = normalizeDisplayText(project.queuePoiLabel);
    if (queuePoiLabel === null) {
      continue;
    }
    const key = buildQueuePoiReferenceLookupKey(
      project.sourceSystem,
      project.stateAbbrev,
      queuePoiLabel
    );
    const countyFipsValues = [
      ...(project.countyFips === null ? [] : [project.countyFips]),
      ...(resolutionByProjectId.get(project.projectId) ?? []).map(
        (resolution) => resolution.countyFips
      ),
    ];
    const uniqueCountyFipsValues = dedupeStrings(countyFipsValues);
    if (uniqueCountyFipsValues.length !== 1) {
      continue;
    }
    const existing = countyFipsByPoiKey.get(key) ?? new Set();
    existing.add(uniqueCountyFipsValues[0] ?? "");
    countyFipsByPoiKey.set(key, existing);
  }
  return new Map(
    [...countyFipsByPoiKey.entries()]
      .map(([key, countyFipsValues]) => [key, [...countyFipsValues]])
      .filter((entry) => entry[1].length === 1)
      .map(([key, countyFipsValues]) => [key, countyFipsValues[0] ?? null])
  );
}
function applyQueuePoiReferenceBackfill(args) {
  const seedMap = buildQueuePoiReferenceSeedMap(args);
  const backfilledProjects = [];
  const countyFipsByProjectId = new Map();
  for (const project of args.queueProjects) {
    let countyFips = project.countyFips;
    let queueCountyConfidence = project.queueCountyConfidence;
    let queueResolverType = project.queueResolverType;
    const queuePoiLabel = normalizeDisplayText(project.queuePoiLabel);
    if (countyFips === null && queuePoiLabel !== null) {
      const matchedCountyFips =
        seedMap.get(
          buildQueuePoiReferenceLookupKey(project.sourceSystem, project.stateAbbrev, queuePoiLabel)
        ) ?? null;
      if (matchedCountyFips !== null) {
        countyFips = matchedCountyFips;
        queueCountyConfidence = "medium";
        queueResolverType = "poi_lookup";
      }
    }
    countyFipsByProjectId.set(project.projectId, countyFips);
    backfilledProjects.push({
      ...project,
      countyFips,
      queueCountyConfidence,
      queueResolverType,
    });
  }
  const existingResolutionProjectIds = new Set(
    args.queueCountyResolutions.map((record) => record.projectId)
  );
  const backfilledResolutions = [...args.queueCountyResolutions];
  for (const project of backfilledProjects) {
    if (
      existingResolutionProjectIds.has(project.projectId) ||
      project.countyFips === null ||
      project.queueResolverType !== "poi_lookup"
    ) {
      continue;
    }
    backfilledResolutions.push({
      allocationShare: 1,
      countyFips: project.countyFips,
      marketId: project.marketId,
      projectId: project.projectId,
      queuePoiLabel: project.queuePoiLabel,
      resolverConfidence: "medium",
      resolverType: "poi_lookup",
      sourceLocationLabel: null,
      sourceSystem: project.sourceSystem,
      stateAbbrev: project.stateAbbrev,
    });
  }
  const backfilledSnapshots = args.queueSnapshots.map((snapshot) => ({
    ...snapshot,
    countyFips: countyFipsByProjectId.get(snapshot.projectId) ?? snapshot.countyFips,
  }));
  return {
    queueCountyResolutions: dedupeJsonRows(backfilledResolutions),
    queueProjects: backfilledProjects,
    queueSnapshots: backfilledSnapshots,
  };
}
function buildQueuePoiReferenceRecords(args) {
  const countyPowerContextByCountyFips = buildCountyPowerContextByCountyFips(
    args.powerMarketRecords
  );
  const recordByKey = new Map();
  for (const project of args.queueProjects) {
    const queuePoiLabel = normalizeDisplayText(project.queuePoiLabel);
    if (project.countyFips === null || queuePoiLabel === null) {
      continue;
    }
    const countyContext = countyPowerContextByCountyFips.get(project.countyFips) ?? null;
    const key = `${project.sourceSystem}:${queuePoiLabel}:${project.countyFips}`;
    const nextRecord = buildQueuePoiReferenceRecord(project, countyContext, queuePoiLabel);
    const existingRecord = recordByKey.get(key) ?? null;
    if (existingRecord === null) {
      recordByKey.set(key, nextRecord);
      continue;
    }
    recordByKey.set(key, mergeQueuePoiReferenceRecord(existingRecord, nextRecord));
  }
  return [...recordByKey.values()].sort((left, right) => {
    const leftKey = `${left.sourceSystem}:${left.queuePoiLabel}:${left.countyFips}`;
    const rightKey = `${right.sourceSystem}:${right.queuePoiLabel}:${right.countyFips}`;
    return leftKey.localeCompare(rightKey);
  });
}
function buildCountyWeightedZoneEntriesFromZipRows(args) {
  const zoneByZip = new Map(
    args.zipZoneRows
      .map((row) => {
        const zipCode = normalizeDisplayText(row["Svc. Address ZIP Code"]);
        const zoneValue =
          normalizeDisplayText(row[args.zoneHeaderName]) ??
          normalizeDisplayText(row[args.zoneHeaderCode]);
        if (zipCode === null || zoneValue === null) {
          return null;
        }
        return [zipCode, zoneValue];
      })
      .filter((value) => value !== null)
  );
  const entries = [];
  for (const row of args.zctaCountyRows) {
    const zipCode = normalizeDisplayText(row.GEOID_ZCTA5_20);
    const countyFips = normalizeDisplayText(row.GEOID_COUNTY_20);
    const areaLandPart = parseOptionalNumber(row.AREALAND_PART);
    const zoneValue = zipCode === null ? null : (zoneByZip.get(zipCode) ?? null);
    if (
      zipCode === null ||
      countyFips === null ||
      areaLandPart === null ||
      zoneValue === null ||
      !args.allowedCountyFips.has(countyFips)
    ) {
      continue;
    }
    entries.push({
      countyFips,
      value: zoneValue,
      weight: areaLandPart,
    });
  }
  return entries;
}
async function buildErcotWeatherZoneByCountyFips(args) {
  const workbookPath = join(args.rawDir, "ercot-appendix-d-profile-decision-tree.xlsx");
  const zctaCountyPath = join(args.rawDir, "census-zcta-county-rel.txt");
  await downloadFile(ERCOT_APPENDIX_D_PROFILE_DECISION_TREE_URL, workbookPath);
  await downloadFile(CENSUS_ZCTA_COUNTY_RELATION_URL, zctaCountyPath);
  const zipZoneRows = readWorkbookRecords({
    firstDataRowIndex: 3,
    headerRowIndexes: [2],
    sheetName: "ZipToZone",
    workbookPath,
  });
  const zctaCountyRows = parsePipeDelimitedRecords(await bunRuntime.file(zctaCountyPath).text());
  const texasCountyFips = new Set(
    args.countyEntries
      .filter((county) => county.stateAbbrev === "TX")
      .map((county) => county.countyFips)
  );
  return {
    map: buildWeightedCountyTextMap(
      buildCountyWeightedZoneEntriesFromZipRows({
        allowedCountyFips: texasCountyFips,
        zoneHeaderCode: "Weather Zone Code",
        zoneHeaderName: "Weather Zone Name",
        zipZoneRows,
        zctaCountyRows,
      })
    ),
    sourceAsOfDate:
      parseCompactUsDate(
        ERCOT_APPENDIX_D_PROFILE_DECISION_TREE_URL.match(ERCOT_APPENDIX_D_DATE_PATTERN)?.[1] ?? "",
        ERCOT_APPENDIX_D_PROFILE_DECISION_TREE_URL.match(ERCOT_APPENDIX_D_DATE_PATTERN)?.[2] ?? "",
        ERCOT_APPENDIX_D_PROFILE_DECISION_TREE_URL.match(ERCOT_APPENDIX_D_DATE_PATTERN)?.[3] ?? ""
      ) ?? args.effectiveDate,
  };
}
function applyCountyTextOverrides(baseMap, overrideMap) {
  const result = new Map(baseMap);
  for (const [countyFips, value] of overrideMap.entries()) {
    result.set(countyFips, value);
  }
  return result;
}
async function resolveNwsCountyZoneCorrelationSource(effectiveDate) {
  const html = await fetchText(NWS_ZONE_COUNTY_PAGE_URL);
  const sourceCandidates = [...html.matchAll(NWS_ZONE_COUNTY_DBX_URL_PATTERN)]
    .map((match) => {
      const href = match[1] ?? null;
      const fileName = match[2] ?? null;
      if (href === null || fileName === null) {
        return null;
      }
      return {
        sourceAsOfDate: parseNwsDbxSourceDate(fileName),
        url: href.startsWith("http") ? href : new URL(href, NWS_ZONE_COUNTY_PAGE_URL).toString(),
      };
    })
    .filter((candidate) => candidate !== null && candidate.sourceAsOfDate !== null);
  if (sourceCandidates.length === 0) {
    throw new Error("Unable to locate the NWS county forecast-zone correlation file");
  }
  const effectiveTimestamp = Date.parse(`${effectiveDate}T00:00:00Z`);
  const rankedCandidates = sourceCandidates.sort((left, right) =>
    left.sourceAsOfDate.localeCompare(right.sourceAsOfDate)
  );
  const currentCandidate =
    [...rankedCandidates]
      .reverse()
      .find(
        (candidate) => Date.parse(`${candidate.sourceAsOfDate}T00:00:00Z`) <= effectiveTimestamp
      ) ??
    rankedCandidates.at(-1) ??
    null;
  if (currentCandidate === null) {
    throw new Error("Unable to determine the active NWS county forecast-zone correlation file");
  }
  return currentCandidate;
}
async function buildNwsMeteoZoneByCountyFips(args) {
  const source = await resolveNwsCountyZoneCorrelationSource(args.effectiveDate);
  const filePath = join(
    args.rawDir,
    `nws-county-forecast-zones-${source.sourceAsOfDate.replaceAll("-", "")}.dbx`
  );
  await downloadFile(source.url, filePath);
  const rows = parseNwsZoneCountyRecords(await bunRuntime.file(filePath).text());
  return {
    map: buildJoinedCountyTextMap(
      rows.flatMap((row) => {
        if (row.countyFips === null || row.zoneName === null) {
          return [];
        }
        const zoneLabel =
          row.stateZone === null ? row.zoneName : `${row.zoneName} (${row.stateZone})`;
        return expandCountyFipsAliases(args.countyFipsAliasLookup, row.countyFips).map(
          (countyFips) => ({
            countyFips,
            value: zoneLabel,
          })
        );
      })
    ),
    sourceAsOfDate: source.sourceAsOfDate,
    sourceUri: source.url,
  };
}
function buildOperatorLoadZoneMap(args) {
  return new Map(
    Object.entries(args.baseMaps).map(([operator, countyMap]) => [
      operator,
      applyCountyTextOverrides(countyMap, COUNTY_LOAD_ZONE_OVERRIDE_MAP.get(operator) ?? new Map()),
    ])
  );
}
function resolveDirectOperatorZoneMetadata(operator) {
  if (operator === "CAISO") {
    return {
      operatorZoneConfidence: "medium",
      operatorZoneType: "queue_study_region",
    };
  }
  if (operator === "MISO") {
    return {
      operatorZoneConfidence: "low",
      operatorZoneType: "local_resource_zone",
    };
  }
  if (operator === "SPP") {
    return {
      operatorZoneConfidence: "medium",
      operatorZoneType: "settlement_location",
    };
  }
  if (operator === "ISO-NE" || operator === "NYISO") {
    return {
      operatorZoneConfidence: "medium",
      operatorZoneType: "load_zone",
    };
  }
  return {
    operatorZoneConfidence: "medium",
    operatorZoneType: "operator_zone",
  };
}
function resolvePjmOperatorZone(dominantUtilityName) {
  if (dominantUtilityName === null) {
    return {
      operatorZoneConfidence: null,
      operatorZoneLabel: null,
      operatorZoneType: null,
    };
  }
  const utilityZone = PJM_UTILITY_LOAD_ZONE_MAP.get(dominantUtilityName) ?? null;
  return {
    operatorZoneConfidence: utilityZone === null ? null : "low",
    operatorZoneLabel: utilityZone,
    operatorZoneType: utilityZone === null ? null : "utility_zone_proxy",
  };
}
function resolveCountyOperatorZone(args) {
  if (args.dominantOperator === null) {
    return {
      operatorZoneConfidence: null,
      operatorZoneLabel: null,
      operatorZoneType: null,
    };
  }
  const operatorCountyMap = args.operatorLoadZoneByCountyFips.get(args.dominantOperator);
  const directLoadZone =
    typeof operatorCountyMap === "undefined"
      ? null
      : (operatorCountyMap.get(args.countyFips) ?? null);
  if (directLoadZone !== null) {
    const { operatorZoneConfidence, operatorZoneType } = resolveDirectOperatorZoneMetadata(
      args.dominantOperator
    );
    return {
      operatorZoneConfidence,
      operatorZoneLabel: directLoadZone,
      operatorZoneType,
    };
  }
  if (args.dominantOperator === "ERCOT" && args.operatorWeatherZone !== null) {
    return {
      operatorZoneConfidence: "high",
      operatorZoneLabel: args.operatorWeatherZone,
      operatorZoneType: "weather_zone",
    };
  }
  if (args.dominantOperator === "PJM" && args.dominantUtilityName !== null) {
    return resolvePjmOperatorZone(args.dominantUtilityName);
  }
  return {
    operatorZoneConfidence: null,
    operatorZoneLabel: null,
    operatorZoneType: null,
  };
}
function buildNyisoQueueRecord(args) {
  const queuePosition = normalizeDisplayText(
    args.record["Queue Pos."] ?? args.record["Queue__Pos."] ?? args.record.Queue
  );
  const projectName = normalizeDisplayText(args.record["Project Name"]);
  if (queuePosition === null || projectName === null) {
    return null;
  }
  const stateAbbrev = normalizeUsStateAbbrev(args.record.State);
  const rawCountyName = normalizeNyisoCountyName(
    args.record.County ?? args.record.Location__County
  );
  const projectId = `nyiso:${args.sheetKey}:${queuePosition}`;
  const countyName = rawCountyName === "Offshore" ? null : rawCountyName;
  const queuePoiLabel = normalizeDisplayText(args.record["Points of Interconnection"]);
  const queueCountyResolution = resolveQueueCountyResolution({
    locationValues: [
      args.record["Points of Interconnection"],
      args.record.Utility,
      args.record["Project Name"],
    ],
    lookupMaps: args.countyLookup,
    marketId: "nyiso",
    placeCountyLookup: args.placeCountyLookup,
    projectId,
    queuePoiLabel,
    sourceLocationLabel: countyName,
    sourceSystem: "nyiso_interconnection_queue",
    stateAbbrev,
  });
  const queueDate = parseOptionalUsLikeDate(
    args.record["Date of IR"] ?? args.record["Date__of IR"] ?? args.record.Date
  );
  const expectedOperationDate =
    parseOptionalUsLikeDate(args.record["Proposed COD"]) ??
    parseOptionalUsLikeDate(args.record["Proposed In-Service/Initial Backfeed Date"]) ??
    parseOptionalUsLikeDate(args.record["Proposed__In-Service"]) ??
    parseOptionalUsLikeDate(args.record.Proposed__COD) ??
    parseOptionalUsLikeDate(args.record["Proposed In-Service"]) ??
    parseOptionalUsLikeDate(args.record.COD);
  let queueStatus = "active";
  if (args.sheetStatus === "withdrawn") {
    queueStatus = "withdrawn";
  } else if (args.sheetStatus === "complete") {
    queueStatus = "complete";
  }
  const zone = normalizeDisplayText(args.record.Z ?? args.record.Zone);
  return {
    countyFips: queueCountyResolution.countyFips,
    countyResolutions: queueCountyResolution.resolutions,
    loadZone: zone,
    project: buildQueueProjectRecord({
      countyFips: queueCountyResolution.countyFips,
      fuelType: normalizeDisplayText(
        args.record["Type/ Fuel"] ??
          args.record["Type/__Fuel"] ??
          args.record["Type/"] ??
          args.record.Fuel
      ),
      marketId: "nyiso",
      nativeStatus: normalizeNativeQueueStatus(args.sheetKey),
      projectId,
      queueStatus,
      queueCountyConfidence: queueCountyResolution.queueCountyConfidence,
      queuePoiLabel,
      queueName: "NYISO Interconnection Queue",
      queueResolverType: queueCountyResolution.queueResolverType,
      sourceAsOfDate: args.sourceAsOfDate,
      sourceSystem: "nyiso_interconnection_queue",
      stateAbbrev,
    }),
    snapshot: buildQueueSnapshotRecord({
      capacityMw: chooseFirstFiniteNumber([
        args.record["SP (MW)"],
        args.record["WP (MW)"],
        args.record["SP__(MW)"],
        args.record["WP__(MW)"],
        args.record.SP,
        args.record.WP,
      ]),
      completionPrior: queueStatus === "complete" || queueStatus === "withdrawn" ? 0 : null,
      countyFips: queueCountyResolution.countyFips,
      effectiveDate: args.effectiveDate,
      expectedOperationDate,
      marketId: "nyiso",
      nativeStatus: normalizeNativeQueueStatus(args.sheetKey),
      projectId,
      queueDate,
      queueStatus,
      signedIa: parseOptionalUsLikeDate(args.record["IA Tender Date"]) !== null,
      sourceSystem: "nyiso_interconnection_queue",
      stateAbbrev,
    }),
    unresolved: buildQueueUnresolvedRecord({
      marketId: "nyiso",
      nativeStatus: normalizeNativeQueueStatus(args.sheetKey),
      projectId,
      queueCountyResolution,
      queueName: "NYISO Interconnection Queue",
      queuePoiLabel,
      sourceSystem: "nyiso_interconnection_queue",
      stateAbbrev,
    }),
  };
}
async function buildNyisoQueueRecords(args) {
  const workbookUrl = await resolveNyisoQueueWorkbookUrl();
  const workbookPath = join(args.rawDir, "nyiso-interconnection-queue.xlsx");
  await downloadFile(workbookUrl, workbookPath);
  const sheetConfigs = [
    {
      expectedHeaders: ["Queue Pos.", "Project Name", "Date of IR", "County", "State"],
      name: "Interconnection Queue",
      sheetKey: "interconnection",
      sheetStatus: "active",
    },
    {
      expectedHeaders: ["Queue Pos.", "Project Name", "Date of IR", "County", "State"],
      name: "Cluster Projects",
      sheetKey: "cluster",
      sheetStatus: "active",
    },
    {
      expectedHeaders: ["Queue Pos.", "Project Name", "Date of IR", "County", "State"],
      name: "Withdrawn",
      sheetKey: "withdrawn",
      sheetStatus: "withdrawn",
    },
    {
      expectedHeaders: ["Queue Pos.", "Project Name", "Date of IR", "County", "State"],
      name: "Cluster Projects-Withdrawn",
      sheetKey: "cluster-withdrawn",
      sheetStatus: "withdrawn",
    },
    {
      expectedHeaders: ["Queue Pos.", "Project Name", "Date of IR", "County", "State"],
      name: "In Service",
      headerRowIndexes: [0, 1],
      firstDataRowIndex: 2,
      sheetKey: "in-service",
      sheetStatus: "complete",
    },
  ];
  const pendingRecords = [];
  let sourceAsOfDate = null;
  for (const sheetConfig of sheetConfigs) {
    const sheetRecords =
      Array.isArray(sheetConfig.headerRowIndexes) &&
      typeof sheetConfig.firstDataRowIndex === "number"
        ? readWorkbookRecords({
            firstDataRowIndex: sheetConfig.firstDataRowIndex,
            headerRowIndexes: sheetConfig.headerRowIndexes,
            sheetName: sheetConfig.name,
            workbookPath,
          })
        : readWorksheetRecordsByHeaders({
            context: `NYISO ${sheetConfig.name}`,
            expectedHeaders: sheetConfig.expectedHeaders,
            rows: readWorksheetRows(workbookPath, sheetConfig.name),
          });
    for (const record of sheetRecords) {
      sourceAsOfDate = pickLatestDate([
        sourceAsOfDate,
        parseOptionalUsLikeDate(record["Last Updated Date"] ?? record["Last Update"]),
      ]);
      pendingRecords.push({
        record,
        sheetKey: sheetConfig.sheetKey,
        sheetStatus: sheetConfig.sheetStatus,
      });
    }
  }
  const finalSourceAsOfDate = sourceAsOfDate ?? args.effectiveDate;
  const records = pendingRecords
    .map((pendingRecord) =>
      buildNyisoQueueRecord({
        countyLookup: args.countyLookup,
        effectiveDate: args.effectiveDate,
        placeCountyLookup: args.placeCountyLookup,
        record: pendingRecord.record,
        sheetKey: pendingRecord.sheetKey,
        sheetStatus: pendingRecord.sheetStatus,
        sourceAsOfDate: finalSourceAsOfDate,
      })
    )
    .filter((record) => record !== null);
  return {
    countyLoadZones: buildDominantCountyTextMap(buildCountyTextEntriesFromQueueRecords(records)),
    countyResolutions: dedupeJsonRows(records.flatMap((record) => record.countyResolutions)),
    projects: dedupeJsonRows(records.map((record) => record.project)),
    snapshots: dedupeJsonRows(records.map((record) => record.snapshot)),
    sourceAsOfDate: finalSourceAsOfDate,
    unresolved: dedupeJsonRows(
      records.map((record) => record.unresolved ?? null).filter((record) => record !== null)
    ),
  };
}
function normalizeIsoNeQueueFuelType(value) {
  const normalized = normalizeDisplayText(value);
  if (normalized === null) {
    return null;
  }
  if (normalized === "WND") {
    return "Wind";
  }
  if (normalized === "SUN") {
    return "Solar";
  }
  if (normalized === "ES") {
    return "Storage";
  }
  if (normalized === "NG") {
    return "Natural Gas";
  }
  return normalized;
}
function buildStableRowHash(values) {
  const hash = createHash("sha1");
  for (const value of values) {
    hash.update(normalizeDisplayText(value) ?? "");
    hash.update("\u001f");
  }
  return hash.digest("hex").slice(0, 12);
}
function buildIsoNeProjectId(record) {
  const queuePosition = normalizeDisplayText(record.QP);
  if (queuePosition === null) {
    return null;
  }
  const projectSlug = slugifyText(
    normalizeDisplayText(record["Alternative Name"]) ??
      normalizeDisplayText(record.Unit) ??
      "project"
  );
  const rowHash = buildStableRowHash([
    record.QP,
    record["Alternative Name"],
    record.Unit,
    record.County,
    record.POI,
    record.ST,
    record.Requested,
    record["Op Date"],
    record["Sync Date"],
    record["Net MW"],
    record["Summer MW"],
    record["Winter MW"],
    record.Status,
    record["Project Status"],
  ]);
  return `iso-ne:${queuePosition}:${projectSlug}:${rowHash}`;
}
function buildIsoNeQueueRecord(args) {
  const queuePosition = normalizeDisplayText(args.record.QP);
  const projectName = normalizeDisplayText(args.record["Alternative Name"]);
  if (queuePosition === null || projectName === null) {
    return null;
  }
  const stateAbbrev = normalizeUsStateAbbrev(args.record.ST);
  const countyName = normalizeDisplayText(args.record.County);
  const queueStatusCode = normalizeDisplayText(args.record.Status);
  const projectId = buildIsoNeProjectId(args.record);
  if (projectId === null) {
    return null;
  }
  const queuePoiLabel = normalizeDisplayText(args.record.POI);
  const queueCountyResolution = resolveQueueCountyResolution({
    locationValues: [
      countyName,
      args.record.POI,
      args.record.Unit,
      args.record["Alternative Name"],
    ],
    lookupMaps: args.countyLookup,
    marketId: "iso-ne",
    placeCountyLookup: args.placeCountyLookup,
    projectId,
    queuePoiLabel,
    sourceLocationLabel: countyName,
    sourceSystem: "iso_ne_public_queue",
    stateAbbrev,
  });
  let queueStatus = "active";
  if (queueStatusCode === "W") {
    queueStatus = "withdrawn";
  } else if (normalizeDisplayText(args.record["Project Status"]) === "In Service") {
    queueStatus = "complete";
  }
  return {
    countyFips: queueCountyResolution.countyFips,
    countyResolutions: queueCountyResolution.resolutions,
    loadZone: normalizeDisplayText(args.record.Zone),
    project: buildQueueProjectRecord({
      countyFips: queueCountyResolution.countyFips,
      fuelType: normalizeIsoNeQueueFuelType(args.record["Fuel Type"]),
      marketId: "iso-ne",
      nativeStatus: normalizeNativeQueueStatus(args.record.Status),
      projectId,
      queueStatus,
      queueCountyConfidence: queueCountyResolution.queueCountyConfidence,
      queuePoiLabel,
      queueName: "ISO-NE Public Queue",
      queueResolverType: queueCountyResolution.queueResolverType,
      sourceAsOfDate: args.sourceAsOfDate,
      sourceSystem: "iso_ne_public_queue",
      stateAbbrev,
    }),
    snapshot: buildQueueSnapshotRecord({
      capacityMw: chooseFirstFiniteNumber([
        args.record["Summer MW"],
        args.record["Winter MW"],
        args.record["Net MW"],
      ]),
      completionPrior: queueStatus === "complete" || queueStatus === "withdrawn" ? 0 : null,
      countyFips: queueCountyResolution.countyFips,
      effectiveDate: args.effectiveDate,
      expectedOperationDate:
        parseOptionalUsLikeDate(args.record["Op Date"]) ??
        parseOptionalUsLikeDate(args.record["Sync Date"]),
      marketId: "iso-ne",
      nativeStatus: normalizeNativeQueueStatus(args.record.Status),
      projectId,
      queueDate: parseOptionalUsLikeDate(args.record.Requested),
      queueStatus,
      signedIa: normalizeDisplayText(args.record.IA) === "Executed",
      sourceSystem: "iso_ne_public_queue",
      stateAbbrev,
    }),
    unresolved: buildQueueUnresolvedRecord({
      marketId: "iso-ne",
      nativeStatus: normalizeNativeQueueStatus(args.record.Status),
      projectId,
      queueCountyResolution,
      queueName: "ISO-NE Public Queue",
      queuePoiLabel,
      sourceSystem: "iso_ne_public_queue",
      stateAbbrev,
    }),
  };
}
async function buildIsoNeQueueRecords(args) {
  const { html } = await fetchIsoNeQueuePage();
  const sourceAsOfDate =
    parseOptionalUsDate(html.match(ISO_NE_QUEUE_AS_OF_DATE_PATTERN)?.[1] ?? null) ??
    args.effectiveDate;
  const records = readHtmlTableRowsById(html, ISO_NE_QUEUE_TABLE_ID)
    .map((record) =>
      buildIsoNeQueueRecord({
        countyLookup: args.countyLookup,
        effectiveDate: args.effectiveDate,
        placeCountyLookup: args.placeCountyLookup,
        record,
        sourceAsOfDate,
      })
    )
    .filter((record) => record !== null);
  return {
    countyLoadZones: buildDominantCountyTextMap(buildCountyTextEntriesFromQueueRecords(records)),
    countyResolutions: dedupeJsonRows(records.flatMap((record) => record.countyResolutions)),
    projects: dedupeJsonRows(records.map((record) => record.project)),
    snapshots: dedupeJsonRows(records.map((record) => record.snapshot)),
    sourceAsOfDate,
    unresolved: dedupeJsonRows(
      records.map((record) => record.unresolved ?? null).filter((record) => record !== null)
    ),
  };
}
function normalizeSppCongestionPointFeature(value) {
  if (!isPlainRecord(value)) {
    throw new Error("Invalid SPP congestion point feature");
  }
  const attributes = isPlainRecord(value.attributes) ? value.attributes : null;
  const geometry = isPlainRecord(value.geometry) ? value.geometry : null;
  if (attributes === null || geometry === null) {
    throw new Error("SPP congestion point feature is missing attributes or geometry");
  }
  const x = typeof geometry.x === "number" ? geometry.x : null;
  const y = typeof geometry.y === "number" ? geometry.y : null;
  if (x === null || y === null) {
    throw new Error("SPP congestion point geometry is invalid");
  }
  return {
    attributes: {
      description:
        typeof attributes.DESCRIPTION === "string"
          ? normalizeDisplayText(attributes.DESCRIPTION)
          : null,
      gmtIntervalEnd:
        typeof attributes.GMTINTERVALEND === "number" ? attributes.GMTINTERVALEND : null,
      lmp: typeof attributes.LMP === "number" ? attributes.LMP : null,
      mcc: typeof attributes.MCC === "number" ? attributes.MCC : null,
      mec: typeof attributes.MEC === "number" ? attributes.MEC : null,
      mlc: typeof attributes.MLC === "number" ? attributes.MLC : null,
      pointType:
        typeof attributes.PNODETYPE === "string"
          ? normalizeDisplayText(attributes.PNODETYPE)
          : null,
      settlementLocation:
        typeof attributes.SETTLEMENT_LOCATION === "string"
          ? normalizeDisplayText(attributes.SETTLEMENT_LOCATION)
          : null,
    },
    geometry: {
      x,
      y,
    },
  };
}
function normalizeSppConstraintFeature(value) {
  if (!isPlainRecord(value)) {
    throw new Error("Invalid SPP constraint feature");
  }
  const attributes = isPlainRecord(value.attributes) ? value.attributes : null;
  const geometry = isPlainRecord(value.geometry) ? value.geometry : null;
  if (attributes === null || geometry === null) {
    throw new Error("SPP constraint feature is missing attributes or geometry");
  }
  const x = typeof geometry.x === "number" ? geometry.x : null;
  const y = typeof geometry.y === "number" ? geometry.y : null;
  if (x === null || y === null) {
    throw new Error("SPP constraint geometry is invalid");
  }
  return {
    attributes: {
      constraintName:
        typeof attributes.CONSTRAINT_NAME === "string"
          ? normalizeDisplayText(attributes.CONSTRAINT_NAME)
          : null,
      contingentFacility:
        typeof attributes.CONTINGENT_FACILITY === "string"
          ? normalizeDisplayText(attributes.CONTINGENT_FACILITY)
          : null,
      gmtIntervalEnd:
        typeof attributes.GMTINTERVALEND === "number" ? attributes.GMTINTERVALEND : null,
      monitoredFacility:
        typeof attributes.MONITORED_FACILITY === "string"
          ? normalizeDisplayText(attributes.MONITORED_FACILITY)
          : null,
      nercId: typeof attributes.NERCID === "number" ? attributes.NERCID : null,
      shadowPrice: typeof attributes.SHADOW_PRICE === "number" ? attributes.SHADOW_PRICE : null,
    },
    geometry: {
      x,
      y,
    },
  };
}
async function fetchSppFeatureLayer(args) {
  const payload = await fetchJson(
    `${SPP_RTBM_FEATURE_SERVICE_URL}/${String(args.layerId)}/query?where=1%3D1&outFields=*&returnGeometry=true&f=pjson`
  );
  const record = isPlainRecord(payload) ? payload : null;
  if (record === null || !Array.isArray(record.features)) {
    throw new Error(`Invalid SPP feature payload for layer ${String(args.layerId)}`);
  }
  return record.features.map(args.normalizeFeature);
}
function percentileFromSorted(values, percentile) {
  if (values.length === 0) {
    return null;
  }
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * percentile) - 1));
  return values[index] ?? null;
}
async function dropSppCongestionStageTables() {
  await bunRuntime.sql
    .unsafe("DROP TABLE IF EXISTS county_power_public_us_spp_constraint_stage")
    .execute();
  await bunRuntime.sql
    .unsafe("DROP TABLE IF EXISTS county_power_public_us_spp_point_stage")
    .execute();
  await bunRuntime.sql
    .unsafe("DROP TABLE IF EXISTS county_power_public_us_spp_county_stage")
    .execute();
}
async function stageSppCountyCongestionData(args) {
  await dropSppCongestionStageTables();
  await createSppCountyStageTable();
  await createSppPointStageTable(args.pricePoints);
  await createSppConstraintStageTable(args.constraints);
}
async function createSppCountyStageTable() {
  await bunRuntime.sql
    .unsafe(`
      CREATE TEMP TABLE county_power_public_us_spp_county_stage AS
      SELECT
        county.county_fips AS county_geoid,
        ST_Transform(county.geom, 3857) AS geom_3857
      FROM serve.boundary_county_geom_lod1 AS county
    `)
    .execute();
  await bunRuntime.sql
    .unsafe(`
      CREATE INDEX county_power_public_us_spp_county_stage_geom_idx
      ON county_power_public_us_spp_county_stage
      USING GIST (geom_3857)
    `)
    .execute();
  await bunRuntime.sql.unsafe("ANALYZE county_power_public_us_spp_county_stage").execute();
}
async function createSppPointStageTable(pricePoints) {
  await bunRuntime.sql
    .unsafe(`
      CREATE TEMP TABLE county_power_public_us_spp_point_stage (
        settlement_location text,
        point_type text,
        description text,
        lmp numeric,
        mlc numeric,
        mcc numeric,
        mec numeric,
        gmt_interval_end timestamptz,
        geom_3857 geometry(Point, 3857) NOT NULL
      )
    `)
    .execute();
  await bunRuntime.sql
    .unsafe(
      `
      INSERT INTO county_power_public_us_spp_point_stage (
        settlement_location,
        point_type,
        description,
        lmp,
        mlc,
        mcc,
        mec,
        gmt_interval_end,
        geom_3857
      )
      SELECT
        NULLIF(feature->'attributes'->>'settlementLocation', '')::text,
        NULLIF(feature->'attributes'->>'pointType', '')::text,
        NULLIF(feature->'attributes'->>'description', '')::text,
        NULLIF(feature->'attributes'->>'lmp', '')::numeric,
        NULLIF(feature->'attributes'->>'mlc', '')::numeric,
        NULLIF(feature->'attributes'->>'mcc', '')::numeric,
        NULLIF(feature->'attributes'->>'mec', '')::numeric,
        CASE
          WHEN NULLIF(feature->'attributes'->>'gmtIntervalEnd', '') IS NULL THEN NULL::timestamptz
          ELSE to_timestamp((feature->'attributes'->>'gmtIntervalEnd')::numeric / 1000.0)
        END AS gmt_interval_end,
        ST_SetSRID(
          ST_MakePoint(
            (feature->'geometry'->>'x')::numeric,
            (feature->'geometry'->>'y')::numeric
          ),
          3857
        ) AS geom_3857
      FROM jsonb_array_elements(($1::jsonb)->'features') AS feature
    `,
      [{ features: pricePoints }]
    )
    .execute();
  await bunRuntime.sql
    .unsafe(`
      CREATE INDEX county_power_public_us_spp_point_stage_geom_idx
      ON county_power_public_us_spp_point_stage
      USING GIST (geom_3857)
    `)
    .execute();
  await bunRuntime.sql.unsafe("ANALYZE county_power_public_us_spp_point_stage").execute();
}
async function createSppConstraintStageTable(constraints) {
  await bunRuntime.sql
    .unsafe(`
      CREATE TEMP TABLE county_power_public_us_spp_constraint_stage (
        constraint_name text,
        contingent_facility text,
        monitored_facility text,
        nerc_id integer,
        shadow_price numeric,
        gmt_interval_end timestamptz,
        geom_3857 geometry(Point, 3857) NOT NULL
      )
    `)
    .execute();
  await bunRuntime.sql
    .unsafe(
      `
      INSERT INTO county_power_public_us_spp_constraint_stage (
        constraint_name,
        contingent_facility,
        monitored_facility,
        nerc_id,
        shadow_price,
        gmt_interval_end,
        geom_3857
      )
      SELECT
        NULLIF(feature->'attributes'->>'constraintName', '')::text,
        NULLIF(feature->'attributes'->>'contingentFacility', '')::text,
        NULLIF(feature->'attributes'->>'monitoredFacility', '')::text,
        NULLIF(feature->'attributes'->>'nercId', '')::integer,
        NULLIF(feature->'attributes'->>'shadowPrice', '')::numeric,
        CASE
          WHEN NULLIF(feature->'attributes'->>'gmtIntervalEnd', '') IS NULL THEN NULL::timestamptz
          ELSE to_timestamp((feature->'attributes'->>'gmtIntervalEnd')::numeric / 1000.0)
        END AS gmt_interval_end,
        ST_SetSRID(
          ST_MakePoint(
            (feature->'geometry'->>'x')::numeric,
            (feature->'geometry'->>'y')::numeric
          ),
          3857
        ) AS geom_3857
      FROM jsonb_array_elements(($1::jsonb)->'features') AS feature
    `,
      [{ features: constraints }]
    )
    .execute();
  await bunRuntime.sql
    .unsafe(`
      CREATE INDEX county_power_public_us_spp_constraint_stage_geom_idx
      ON county_power_public_us_spp_constraint_stage
      USING GIST (geom_3857)
    `)
    .execute();
  await bunRuntime.sql.unsafe("ANALYZE county_power_public_us_spp_constraint_stage").execute();
}
async function querySppCongestionStageRows() {
  const priceRows = readUnknownRecordArray(
    await bunRuntime.sql
      .unsafe(`
        SELECT
          county.county_geoid,
          stage.settlement_location,
          stage.description,
          stage.lmp,
          stage.mcc,
          stage.gmt_interval_end
        FROM county_power_public_us_spp_county_stage AS county
        JOIN county_power_public_us_spp_point_stage AS stage
          ON stage.geom_3857 && county.geom_3857
         AND ST_Intersects(stage.geom_3857, county.geom_3857)
      `)
      .execute()
  );
  const constraintRows = readUnknownRecordArray(
    await bunRuntime.sql
      .unsafe(`
        SELECT
          county.county_geoid,
          stage.constraint_name,
          stage.contingent_facility,
          stage.monitored_facility,
          stage.nerc_id,
          stage.shadow_price,
          stage.gmt_interval_end
        FROM county_power_public_us_spp_county_stage AS county
        JOIN county_power_public_us_spp_constraint_stage AS stage
          ON stage.geom_3857 && county.geom_3857
         AND ST_Intersects(stage.geom_3857, county.geom_3857)
      `)
      .execute()
  );
  return {
    constraintRows,
    priceRows,
  };
}
function updateMaxTimestamp(currentMaxTimestamp, value) {
  const timestampValue = value instanceof Date ? value.getTime() : Date.parse(String(value));
  if (!Number.isFinite(timestampValue)) {
    return currentMaxTimestamp;
  }
  return Math.max(currentMaxTimestamp, timestampValue);
}
function collectSppCountyPriceRows(args) {
  let maxTimestamp = 0;
  for (const row of args.priceRows) {
    const countyFips =
      typeof row.county_geoid === "string" ? normalizeDisplayText(row.county_geoid) : null;
    if (countyFips === null) {
      continue;
    }
    const congestionComponent = Number(row.mcc);
    if (Number.isFinite(congestionComponent)) {
      const existing = args.countyPriceMap.get(countyFips) ?? [];
      existing.push(congestionComponent);
      args.countyPriceMap.set(countyFips, existing);
    }
    maxTimestamp = updateMaxTimestamp(maxTimestamp, row.gmt_interval_end);
  }
  return maxTimestamp;
}
function collectSppSettlementLocationRows(args) {
  for (const row of args.priceRows) {
    const countyFips =
      typeof row.county_geoid === "string" ? normalizeDisplayText(row.county_geoid) : null;
    const settlementLocation =
      typeof row.settlement_location === "string"
        ? normalizeDisplayText(row.settlement_location)
        : null;
    if (countyFips !== null && settlementLocation !== null) {
      args.countySettlementLocationEntries.push({
        countyFips,
        value: settlementLocation,
      });
    }
    if (settlementLocation === null) {
      continue;
    }
    const congestionComponent = Number(row.mcc);
    if (Number.isFinite(congestionComponent)) {
      const congestionValues =
        args.settlementLocationCongestionValues.get(settlementLocation) ?? [];
      congestionValues.push(congestionComponent);
      args.settlementLocationCongestionValues.set(settlementLocation, congestionValues);
    }
    const totalLmp = Number(row.lmp);
    if (Number.isFinite(totalLmp)) {
      const negativePriceCounter = args.settlementLocationNegativePriceCounts.get(
        settlementLocation
      ) ?? {
        negativeCount: 0,
        totalCount: 0,
      };
      negativePriceCounter.totalCount += 1;
      if (totalLmp < 0) {
        negativePriceCounter.negativeCount += 1;
      }
      args.settlementLocationNegativePriceCounts.set(settlementLocation, negativePriceCounter);
    }
  }
}
function collectSppCountyConstraintRows(args) {
  let maxTimestamp = 0;
  for (const row of args.constraintRows) {
    const countyFips =
      typeof row.county_geoid === "string" ? normalizeDisplayText(row.county_geoid) : null;
    const shadowPrice = Number(row.shadow_price);
    if (countyFips === null || !Number.isFinite(shadowPrice)) {
      continue;
    }
    const existing = args.countyConstraintMap.get(countyFips) ?? [];
    existing.push({
      contingentFacility:
        typeof row.contingent_facility === "string"
          ? normalizeDisplayText(row.contingent_facility)
          : null,
      constraintName:
        typeof row.constraint_name === "string" ? normalizeDisplayText(row.constraint_name) : null,
      monitoredFacility:
        typeof row.monitored_facility === "string"
          ? normalizeDisplayText(row.monitored_facility)
          : null,
      nercId: typeof row.nerc_id === "number" ? row.nerc_id : null,
      shadowPrice,
    });
    args.countyConstraintMap.set(countyFips, existing);
    maxTimestamp = updateMaxTimestamp(maxTimestamp, row.gmt_interval_end);
  }
  return maxTimestamp;
}
function averageCongestionComponent(values) {
  if (values.length === 0) {
    return null;
  }
  return roundTo(values.reduce((sum, value) => sum + value, 0) / values.length, 4);
}
function percentileShadowPrice(constraints) {
  const shadowPrices = constraints
    .map((entry) => entry.shadowPrice)
    .sort((left, right) => left - right);
  const percentileValue = percentileFromSorted(shadowPrices, 0.95);
  if (percentileValue === null) {
    return null;
  }
  return roundTo(percentileValue, 4);
}
function buildSppCountyCongestionOutput(args) {
  const countyFipsValues = [
    ...dedupeStrings([...args.countyPriceMap.keys(), ...args.countyConstraintMap.keys()]),
  ].sort((left, right) => left.localeCompare(right));
  return countyFipsValues.map((countyFips) => {
    const congestionComponents = [...(args.countyPriceMap.get(countyFips) ?? [])].sort(
      (left, right) => left - right
    );
    const countyConstraints = [...(args.countyConstraintMap.get(countyFips) ?? [])].sort(
      (left, right) => right.shadowPrice - left.shadowPrice
    );
    return {
      avgRtCongestionComponent: averageCongestionComponent(congestionComponents),
      countyFips,
      negativePriceHourShare: null,
      p95ShadowPrice: percentileShadowPrice(countyConstraints),
      topConstraints: countyConstraints.slice(0, 5).map((entry) => ({
        constraintId:
          entry.nercId === null
            ? (entry.constraintName ?? entry.monitoredFacility ?? "SPP-constraint")
            : String(entry.nercId),
        flowMw: null,
        hoursBound: null,
        label: entry.constraintName ?? entry.monitoredFacility ?? "SPP constraint",
        limitMw: null,
        operator: "SPP",
        shadowPrice: roundTo(entry.shadowPrice, 4),
        voltageKv: parseVoltageKv(entry.monitoredFacility),
      })),
    };
  });
}
function buildSppSettlementLocationAggregates(args) {
  const records = new Map();
  for (const [settlementLocation, congestionValues] of args.settlementLocationCongestionValues) {
    const negativePriceCounter =
      args.settlementLocationNegativePriceCounts.get(settlementLocation) ?? null;
    records.set(settlementLocation, {
      avgRtCongestionComponent: averageCongestionComponent(congestionValues),
      negativePriceHourShare:
        negativePriceCounter === null || negativePriceCounter.totalCount === 0
          ? null
          : roundTo(negativePriceCounter.negativeCount / negativePriceCounter.totalCount, 6),
      p95ShadowPrice: null,
      topConstraints: [],
    });
  }
  return records;
}
async function buildSppCountyCongestionRecords() {
  const pricePoints = [
    ...(await fetchSppFeatureLayer({
      layerId: 1,
      normalizeFeature: normalizeSppCongestionPointFeature,
    })),
    ...(await fetchSppFeatureLayer({
      layerId: 2,
      normalizeFeature: normalizeSppCongestionPointFeature,
    })),
  ];
  const constraints = await fetchSppFeatureLayer({
    layerId: 4,
    normalizeFeature: normalizeSppConstraintFeature,
  });
  const countySettlementLocationEntries = [];
  const countyPriceMap = new Map();
  const countyConstraintMap = new Map();
  const settlementLocationCongestionValues = new Map();
  const settlementLocationNegativePriceCounts = new Map();
  try {
    await stageSppCountyCongestionData({
      constraints,
      pricePoints,
    });
    const { constraintRows, priceRows } = await querySppCongestionStageRows();
    const maxPriceTimestamp = collectSppCountyPriceRows({
      countyPriceMap,
      priceRows,
    });
    collectSppSettlementLocationRows({
      countySettlementLocationEntries,
      priceRows,
      settlementLocationCongestionValues,
      settlementLocationNegativePriceCounts,
    });
    const maxConstraintTimestamp = collectSppCountyConstraintRows({
      constraintRows,
      countyConstraintMap,
    });
    const maxTimestamp = Math.max(maxPriceTimestamp, maxConstraintTimestamp);
    return {
      countySettlementLocations: buildDominantCountyTextMap(countySettlementLocationEntries),
      records: buildSppCountyCongestionOutput({
        countyConstraintMap,
        countyPriceMap,
      }),
      zonalAggregates: buildSppSettlementLocationAggregates({
        settlementLocationCongestionValues,
        settlementLocationNegativePriceCounts,
      }),
      sourceAsOfDate: maxTimestamp > 0 ? toIsoDate(new Date(maxTimestamp)) : toIsoDate(new Date()),
    };
  } finally {
    await dropSppCongestionStageTables();
  }
}
function averageFiniteNumbers(values, digits) {
  if (values.length === 0) {
    return null;
  }
  return roundTo(values.reduce((sum, value) => sum + value, 0) / values.length, digits);
}
function appendMapArrayValue(map, key, value) {
  const existingValues = map.get(key) ?? [];
  existingValues.push(value);
  map.set(key, existingValues);
}
function recordNegativePriceCounter(map, key, totalLmp) {
  const negativePriceCounter = map.get(key) ?? {
    negativeCount: 0,
    totalCount: 0,
  };
  negativePriceCounter.totalCount += 1;
  if (totalLmp < 0) {
    negativePriceCounter.negativeCount += 1;
  }
  map.set(key, negativePriceCounter);
}
function buildNamedZonalCongestionAggregates(zonalCongestionValues, zonalNegativePriceCounts) {
  return new Map(
    [...zonalCongestionValues.entries()].map(([zoneLabel, zoneValues]) => {
      const negativePriceCounter = zonalNegativePriceCounts.get(zoneLabel) ?? null;
      return [
        zoneLabel,
        {
          avgRtCongestionComponent: averageFiniteNumbers(zoneValues, 4),
          negativePriceHourShare:
            negativePriceCounter === null || negativePriceCounter.totalCount === 0
              ? null
              : roundTo(negativePriceCounter.negativeCount / negativePriceCounter.totalCount, 6),
          p95ShadowPrice: null,
          topConstraints: [],
        },
      ];
    })
  );
}
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Constraint aggregation intentionally normalizes multiple public operator payload shapes in one pass.
function buildConstraintSummaryAggregate(entries, operator) {
  const constraintMap = new Map();
  const shadowMagnitudes = [];
  for (const entry of entries) {
    if (typeof entry.shadowPrice !== "number" || !Number.isFinite(entry.shadowPrice)) {
      continue;
    }
    const shadowMagnitude = Math.abs(entry.shadowPrice);
    shadowMagnitudes.push(shadowMagnitude);
    const constraintId = entry.constraintId ?? entry.label;
    if (constraintId === null) {
      continue;
    }
    const existing = constraintMap.get(constraintId) ?? {
      constraintId,
      flowMw: null,
      hoursBound: 0,
      label: entry.label ?? constraintId,
      limitMw: null,
      operator,
      representativeShadowPrice: entry.shadowPrice,
      shadowMagnitude,
      voltageKv: entry.voltageKv ?? null,
    };
    existing.hoursBound += 1;
    if (shadowMagnitude >= existing.shadowMagnitude) {
      existing.label = entry.label ?? constraintId;
      existing.representativeShadowPrice = entry.shadowPrice;
      existing.shadowMagnitude = shadowMagnitude;
      existing.voltageKv = entry.voltageKv ?? existing.voltageKv;
      existing.flowMw =
        typeof entry.flowMw === "number" && Number.isFinite(entry.flowMw) ? entry.flowMw : null;
      existing.limitMw =
        typeof entry.limitMw === "number" && Number.isFinite(entry.limitMw) ? entry.limitMw : null;
    }
    constraintMap.set(constraintId, existing);
  }
  const topConstraints = [...constraintMap.values()]
    .sort((left, right) => right.shadowMagnitude - left.shadowMagnitude)
    .slice(0, 5)
    .map((entry) => ({
      constraintId: entry.constraintId,
      flowMw: entry.flowMw,
      hoursBound: entry.hoursBound,
      label: entry.label,
      limitMw: entry.limitMw,
      operator: entry.operator,
      shadowPrice: roundTo(entry.representativeShadowPrice, 4),
      voltageKv: entry.voltageKv,
    }));
  const sortedShadowMagnitudes = [...shadowMagnitudes].sort((left, right) => left - right);
  const p95ShadowPrice = percentileFromSorted(sortedShadowMagnitudes, 0.95);
  return {
    p95ShadowPrice: p95ShadowPrice === null ? null : roundTo(p95ShadowPrice, 4),
    topConstraints,
  };
}
function hasCongestionSignal(record) {
  return (
    typeof record.avgRtCongestionComponent === "number" ||
    typeof record.negativePriceHourShare === "number" ||
    typeof record.p95ShadowPrice === "number" ||
    record.topConstraints.length > 0
  );
}
function buildAggregateCongestionFromCountyRecords(records) {
  const avgCongestionValues = [];
  const negativeShareValues = [];
  const constraintEntries = [];
  for (const record of records) {
    if (typeof record.avgRtCongestionComponent === "number") {
      avgCongestionValues.push(record.avgRtCongestionComponent);
    }
    if (typeof record.negativePriceHourShare === "number") {
      negativeShareValues.push(record.negativePriceHourShare);
    }
    for (const constraint of record.topConstraints) {
      constraintEntries.push({
        constraintId: constraint.constraintId,
        flowMw: constraint.flowMw,
        label: constraint.label,
        limitMw: constraint.limitMw,
        shadowPrice: constraint.shadowPrice,
        voltageKv: constraint.voltageKv,
      });
    }
  }
  const constraintSummary = buildConstraintSummaryAggregate(constraintEntries, "SPP");
  return {
    avgRtCongestionComponent: averageFiniteNumbers(avgCongestionValues, 4),
    negativePriceHourShare: averageFiniteNumbers(negativeShareValues, 6),
    p95ShadowPrice: constraintSummary.p95ShadowPrice,
    topConstraints: constraintSummary.topConstraints,
  };
}
function fetchCaisoOasisCsv(args) {
  const zipPath = join(args.rawDir, args.fileName);
  const query = new URLSearchParams({
    enddatetime: `${compactIsoDate(args.endDate)}T00:00-0000`,
    market_run_id: args.marketRunId,
    queryname: args.queryName,
    resultformat: "6",
    startdatetime: `${compactIsoDate(args.startDate)}T00:00-0000`,
    version: args.version,
    ...(args.extraParams ?? {}),
  });
  return downloadZipTextFromUrl({
    url: `${CAISO_OASIS_SINGLE_ZIP_URL}?${query.toString()}`,
    zipPath,
  });
}
function calculateCaisoIntervalTotalLmp(entry) {
  if (typeof entry.LMP === "number") {
    return entry.LMP;
  }
  if (
    typeof entry.MCC === "number" ||
    typeof entry.MCE === "number" ||
    typeof entry.MCL === "number"
  ) {
    return (entry.MCC ?? 0) + (entry.MCE ?? 0) + (entry.MCL ?? 0);
  }
  return null;
}
async function buildCaisoOperatorCongestionSummary(args) {
  const targetDate = shiftIsoDate(args.effectiveDate, -1);
  const endDate = shiftIsoDate(targetDate, 1);
  const lmpCsv = await fetchCaisoOasisCsv({
    extraParams: {
      grp_type: "ALL",
    },
    fileName: `caiso-prc-intvl-lmp-${targetDate}.zip`,
    marketRunId: "RTM",
    queryName: "PRC_INTVL_LMP",
    rawDir: args.rawDir,
    startDate: targetDate,
    endDate,
    version: "1",
  });
  const nomogramCsv = await fetchCaisoOasisCsv({
    fileName: `caiso-prc-rtm-nomogram-${targetDate}.zip`,
    marketRunId: "RTM",
    queryName: "PRC_RTM_NOMOGRAM",
    rawDir: args.rawDir,
    startDate: targetDate,
    endDate,
    version: "1",
  });
  const lmpRows = parseCsvRecordsWithHeaderLine(lmpCsv, 0).filter(
    (row) => row.INTERVALSTARTTIME_GMT !== null
  );
  const intervalNodeValues = new Map();
  const congestionValues = [];
  for (const row of lmpRows) {
    const lmpType = normalizeDisplayText(row.LMP_TYPE);
    const nodeId = normalizeDisplayText(row.NODE_ID);
    const intervalStart = normalizeDisplayText(row.INTERVALSTARTTIME_GMT);
    const mw = parseOptionalNumber(row.MW);
    if (lmpType === "MCC" && mw !== null) {
      congestionValues.push(mw);
    }
    if (nodeId === null || intervalStart === null || mw === null) {
      continue;
    }
    const key = `${nodeId}|${intervalStart}`;
    const existing = intervalNodeValues.get(key) ?? {};
    existing[lmpType ?? "UNKNOWN"] = mw;
    intervalNodeValues.set(key, existing);
  }
  let totalPriceCount = 0;
  let negativePriceCount = 0;
  for (const entry of intervalNodeValues.values()) {
    const totalLmp = calculateCaisoIntervalTotalLmp(entry);
    if (typeof totalLmp === "number" && Number.isFinite(totalLmp)) {
      totalPriceCount += 1;
      if (totalLmp < 0) {
        negativePriceCount += 1;
      }
    }
  }
  const nomogramRows = parseCsvRecordsWithHeaderLine(nomogramCsv, 0).filter(
    (row) => row.INTERVALSTARTTIME_GMT !== null
  );
  const constraintSummary = buildConstraintSummaryAggregate(
    nomogramRows.map((row) => ({
      constraintId: normalizeDisplayText(row.NOMOGRAM_ID) ?? "CAISO-constraint",
      flowMw: null,
      label:
        normalizeDisplayText(row.CONSTRAINT_CAUSE) ??
        normalizeDisplayText(row.NOMOGRAM_ID) ??
        "CAISO constraint",
      limitMw: null,
      shadowPrice: parseOptionalNumber(row.PRC),
      voltageKv: parseVoltageKv(normalizeDisplayText(row.NOMOGRAM_ID)),
    })),
    "CAISO"
  );
  return {
    aggregate: {
      avgRtCongestionComponent: averageFiniteNumbers(congestionValues, 4),
      negativePriceHourShare:
        totalPriceCount === 0 ? null : roundTo(negativePriceCount / totalPriceCount, 6),
      p95ShadowPrice: constraintSummary.p95ShadowPrice,
      topConstraints: constraintSummary.topConstraints,
    },
    sourceAsOfDate: targetDate,
  };
}
function resolveNyisoCurrentCsvUrl(listHtml, contextLabel) {
  const hrefMatches = [...listHtml.matchAll(NYISO_CSV_LINK_PATTERN)];
  const preferredHref =
    hrefMatches.find((match) => NYISO_DATED_CSV_PATH_PATTERN.test(match[1] ?? ""))?.[1] ??
    hrefMatches.find((match) => !(match[1] ?? "").includes("/current"))?.[1] ??
    hrefMatches[0]?.[1] ??
    null;
  const href = typeof preferredHref === "string" ? preferredHref : null;
  if (href === null) {
    throw new Error(`Unable to resolve the NYISO ${contextLabel} current CSV URL`);
  }
  return href.startsWith("http") ? href : new URL(href, `${NYISO_PUBLIC_BASE_URL}/`).toString();
}
async function buildNyisoOperatorCongestionSummary() {
  const realtimeListHtml = await fetchText(NYISO_REALTIME_ZONAL_LBMP_LIST_URL);
  const constraintListHtml = await fetchText(NYISO_LIMITING_CONSTRAINTS_LIST_URL);
  const realtimeCsv = await fetchText(
    resolveNyisoCurrentCsvUrl(realtimeListHtml, "real-time zonal LBMP")
  );
  const constraintCsv = await fetchText(
    resolveNyisoCurrentCsvUrl(constraintListHtml, "limiting constraints")
  );
  const lmpRows = parseCsvRecordsWithHeaderLine(realtimeCsv, 0);
  const congestionValues = [];
  const zonalCongestionValues = new Map();
  let negativePriceCount = 0;
  const zonalNegativePriceCounts = new Map();
  let totalPriceCount = 0;
  let latestTimestamp = 0;
  for (const row of lmpRows) {
    const zoneLabel =
      normalizeDisplayText(row.Zone) ??
      normalizeDisplayText(row.PTID_Name) ??
      normalizeDisplayText(row.Name);
    const congestionPrice = parseOptionalNumber(row["Marginal Cost Congestion ($/MWHr)"]);
    if (congestionPrice !== null) {
      congestionValues.push(congestionPrice);
      if (zoneLabel !== null) {
        appendMapArrayValue(zonalCongestionValues, zoneLabel, congestionPrice);
      }
    }
    const totalLmp = parseOptionalNumber(row["LBMP ($/MWHr)"]);
    if (totalLmp !== null) {
      totalPriceCount += 1;
      if (totalLmp < 0) {
        negativePriceCount += 1;
      }
      if (zoneLabel !== null) {
        recordNegativePriceCounter(zonalNegativePriceCounts, zoneLabel, totalLmp);
      }
    }
    latestTimestamp = updateMaxTimestamp(latestTimestamp, row["Time Stamp"]);
  }
  const constraintRows = parseCsvRecordsWithHeaderLine(constraintCsv, 0);
  const constraintSummary = buildConstraintSummaryAggregate(
    constraintRows.map((row) => ({
      constraintId:
        normalizeDisplayText(row["Facility PTID"]) ??
        normalizeDisplayText(row["Limiting Facility"]) ??
        "NYISO-constraint",
      flowMw: null,
      label: normalizeDisplayText(row["Limiting Facility"]) ?? "NYISO constraint",
      limitMw: null,
      shadowPrice: parseOptionalNumber(row["Constraint Cost($)"]),
      voltageKv: parseVoltageKv(normalizeDisplayText(row["Limiting Facility"])),
    })),
    "NYISO"
  );
  latestTimestamp = updateMaxTimestamp(latestTimestamp, constraintRows[0]?.["Time Stamp"] ?? null);
  return {
    aggregate: {
      avgRtCongestionComponent: averageFiniteNumbers(congestionValues, 4),
      negativePriceHourShare:
        totalPriceCount === 0 ? null : roundTo(negativePriceCount / totalPriceCount, 6),
      p95ShadowPrice: constraintSummary.p95ShadowPrice,
      topConstraints: constraintSummary.topConstraints,
    },
    zonalAggregates: buildNamedZonalCongestionAggregates(
      zonalCongestionValues,
      zonalNegativePriceCounts
    ),
    sourceAsOfDate:
      latestTimestamp > 0 ? toIsoDate(new Date(latestTimestamp)) : toIsoDate(new Date()),
  };
}
async function buildIsoNeOperatorCongestionSummary(args) {
  const targetDate = shiftIsoDate(args.effectiveDate, -1);
  const lmpPage = await fetchIsoNeIsoexpressPage(ISO_NE_REAL_TIME_LMP_SOURCE_PAGE_URL);
  const constraintPage = await fetchIsoNeIsoexpressPage(
    ISO_NE_REAL_TIME_CONSTRAINT_SOURCE_PAGE_URL
  );
  const availableLmpDates = [...lmpPage.html.matchAll(ISO_NE_RT_LMP_CSV_URL_PATTERN)]
    .map((match) => match[1] ?? null)
    .filter((value) => value !== null)
    .sort((left, right) => right.localeCompare(left));
  const preferredLmpDate =
    availableLmpDates.find((value) => value <= compactIsoDate(targetDate)) ??
    availableLmpDates[0] ??
    compactIsoDate(targetDate);
  const lmpCsv = await fetchIsoNeIsoexpressText({
    cookieHeader: lmpPage.cookieHeader,
    url: `https://www.iso-ne.com/static-transform/csv/histRpts/rt-lmp/lmp_rt_final_${preferredLmpDate}.csv`,
  });
  const constraintCsv = await fetchIsoNeIsoexpressText({
    cookieHeader: constraintPage.cookieHeader,
    url: `https://www.iso-ne.com/transform/csv/fifteenminuteconstraints?type=prelim&start=${compactIsoDate(targetDate)}&end=${compactIsoDate(targetDate)}`,
  });
  const lmpRows = parseCsvRecordsWithHeaderLine(lmpCsv, 4).filter(
    (row) => parseOptionalUsLikeDate(row.Date) !== null
  );
  const congestionValues = [];
  const zonalCongestionValues = new Map();
  let negativePriceCount = 0;
  const zonalNegativePriceCounts = new Map();
  let totalPriceCount = 0;
  for (const row of lmpRows) {
    if (normalizeDisplayText(row["Location Type"]) !== "LOAD ZONE") {
      continue;
    }
    const zoneLabel = normalizeDisplayText(row["Location Name"]);
    const congestionPrice = parseOptionalNumber(row["Congestion Component"]);
    if (congestionPrice !== null) {
      congestionValues.push(congestionPrice);
      if (zoneLabel !== null) {
        appendMapArrayValue(zonalCongestionValues, zoneLabel, congestionPrice);
      }
    }
    const totalLmp = parseOptionalNumber(row["Locational Marginal Price"]);
    if (totalLmp !== null) {
      totalPriceCount += 1;
      if (totalLmp < 0) {
        negativePriceCount += 1;
      }
      if (zoneLabel !== null) {
        recordNegativePriceCounter(zonalNegativePriceCounts, zoneLabel, totalLmp);
      }
    }
  }
  const constraintRows = parseCsvRecordsWithHeaderLine(constraintCsv, 4).filter(
    (row) => parseOptionalUsLikeDate(row["Local Date"]) !== null
  );
  const constraintSummary = buildConstraintSummaryAggregate(
    constraintRows.map((row) => ({
      constraintId: normalizeDisplayText(row["Constraint Name"]) ?? "ISO-NE-constraint",
      flowMw: null,
      label: normalizeDisplayText(row["Constraint Name"]) ?? "ISO-NE constraint",
      limitMw: null,
      shadowPrice: parseOptionalNumber(row["Marginal Value"]),
      voltageKv: parseVoltageKv(normalizeDisplayText(row["Constraint Name"])),
    })),
    "ISO-NE"
  );
  return {
    aggregate: {
      avgRtCongestionComponent: averageFiniteNumbers(congestionValues, 4),
      negativePriceHourShare:
        totalPriceCount === 0 ? null : roundTo(negativePriceCount / totalPriceCount, 6),
      p95ShadowPrice: constraintSummary.p95ShadowPrice,
      topConstraints: constraintSummary.topConstraints,
    },
    zonalAggregates: buildNamedZonalCongestionAggregates(
      zonalCongestionValues,
      zonalNegativePriceCounts
    ),
    sourceAsOfDate: targetDate,
  };
}
function buildOperatorCountyMap(powerMarketRecords) {
  const countyMap = new Map();
  for (const record of powerMarketRecords) {
    const operator = normalizeDisplayText(record.wholesaleOperator);
    if (operator === null) {
      continue;
    }
    const counties = countyMap.get(operator) ?? [];
    counties.push(record.countyFips);
    countyMap.set(operator, counties);
  }
  return countyMap;
}
function buildCountyZoneContextMap(powerMarketRecords) {
  return new Map(
    powerMarketRecords
      .filter((record) => record.operatorZoneLabel !== null && record.wholesaleOperator !== null)
      .map((record) => [
        record.countyFips,
        {
          operatorZoneLabel: record.operatorZoneLabel,
          wholesaleOperator: record.wholesaleOperator,
        },
      ])
  );
}
function assignAggregateCongestionToCounties(countyFipsValues, aggregate) {
  if (!hasCongestionSignal(aggregate)) {
    return [];
  }
  return countyFipsValues.map((countyFips) => ({
    avgRtCongestionComponent: aggregate.avgRtCongestionComponent,
    countyFips,
    negativePriceHourShare: aggregate.negativePriceHourShare,
    p95ShadowPrice: aggregate.p95ShadowPrice,
    topConstraints: aggregate.topConstraints,
  }));
}
function mergeCountyCongestionRecord(existingRecord, incomingRecord) {
  if (typeof existingRecord === "undefined") {
    return incomingRecord;
  }
  return {
    avgRtCongestionComponent:
      incomingRecord.avgRtCongestionComponent ?? existingRecord.avgRtCongestionComponent,
    countyFips: incomingRecord.countyFips,
    negativePriceHourShare:
      incomingRecord.negativePriceHourShare ?? existingRecord.negativePriceHourShare,
    p95ShadowPrice: incomingRecord.p95ShadowPrice ?? existingRecord.p95ShadowPrice,
    topConstraints:
      incomingRecord.topConstraints.length > 0
        ? incomingRecord.topConstraints
        : existingRecord.topConstraints,
  };
}
function buildMergedCountyCongestionRecords(args) {
  const countyRecordMap = new Map();
  const countyZoneContextMap = buildCountyZoneContextMap(args.powerMarketRecords);
  const applyAggregate = (operator, aggregate) => {
    const countyFipsValues = args.operatorCountyMap.get(operator) ?? [];
    for (const record of assignAggregateCongestionToCounties(countyFipsValues, aggregate)) {
      countyRecordMap.set(
        record.countyFips,
        mergeCountyCongestionRecord(countyRecordMap.get(record.countyFips), record)
      );
    }
  };
  const applyZonalAggregate = (operator, zonalAggregates) => {
    for (const [countyFips, countyZoneContext] of countyZoneContextMap.entries()) {
      if (countyZoneContext.wholesaleOperator !== operator) {
        continue;
      }
      const aggregate = zonalAggregates.get(countyZoneContext.operatorZoneLabel) ?? null;
      if (aggregate === null || !hasCongestionSignal(aggregate)) {
        continue;
      }
      countyRecordMap.set(
        countyFips,
        mergeCountyCongestionRecord(countyRecordMap.get(countyFips), {
          avgRtCongestionComponent: aggregate.avgRtCongestionComponent,
          countyFips,
          negativePriceHourShare: aggregate.negativePriceHourShare,
          p95ShadowPrice: aggregate.p95ShadowPrice,
          topConstraints: aggregate.topConstraints,
        })
      );
    }
  };
  applyAggregate("CAISO", args.caisoAggregate);
  applyAggregate("ERCOT", args.ercotAggregate);
  applyAggregate("ISO-NE", args.isoNeAggregate);
  applyAggregate("MISO", args.misoAggregate);
  applyAggregate("NYISO", args.nyisoAggregate);
  applyAggregate("PJM", args.pjmAggregate);
  applyAggregate("SPP", args.sppAggregate);
  applyZonalAggregate("ISO-NE", args.isoNeZonalAggregates);
  applyZonalAggregate("MISO", args.misoZonalAggregates);
  applyZonalAggregate("NYISO", args.nyisoZonalAggregates);
  applyZonalAggregate("PJM", args.pjmZonalAggregates);
  applyZonalAggregate("SPP", args.sppZonalAggregates);
  for (const record of args.sppCountyRecords) {
    countyRecordMap.set(
      record.countyFips,
      mergeCountyCongestionRecord(countyRecordMap.get(record.countyFips), record)
    );
  }
  return [...countyRecordMap.values()].sort((left, right) =>
    left.countyFips.localeCompare(right.countyFips)
  );
}
async function fetchPjmApiItems(args) {
  const query = new URLSearchParams();
  for (const entry of Object.entries(args.params)) {
    const [key, value] = entry;
    if (typeof value === "string" && value.length > 0) {
      query.set(key, value);
    }
  }
  const payload = await fetchJson(`${PJM_API_BASE_URL}/${args.feedName}?${query.toString()}`, {
    headers: {
      "Ocp-Apim-Subscription-Key": PJM_API_SUBSCRIPTION_KEY,
    },
  });
  if (!(isPlainRecord(payload) && Array.isArray(payload.items))) {
    throw new Error(`Invalid PJM payload for ${args.feedName}`);
  }
  return payload.items.filter((item) => isPlainRecord(item));
}
async function resolvePjmAggregatePnodeId() {
  const rows = await fetchPjmApiItems({
    feedName: "pnode",
    params: {
      order: "ASC",
      pnode_subtype: "ZONE",
      rowCount: "100",
      sort: "pnode_name",
      startRow: "1",
      termination_date: "12/31/9999 exact",
    },
  });
  const aggregateRow =
    rows.find((row) => normalizeDisplayText(row.pnode_name) === "PJM-RTO") ??
    rows.find((row) => normalizeDisplayText(row.pnode_name) === "PJM") ??
    null;
  const pnodeId =
    aggregateRow !== null &&
    typeof aggregateRow.pnode_id === "number" &&
    Number.isInteger(aggregateRow.pnode_id)
      ? aggregateRow.pnode_id
      : null;
  if (pnodeId === null) {
    throw new Error("Unable to resolve the active PJM aggregate pricing node");
  }
  return pnodeId;
}
async function listPjmZonePnodes() {
  const rows = await fetchPjmApiItems({
    feedName: "pnode",
    params: {
      order: "ASC",
      pnode_subtype: "ZONE",
      rowCount: "5000",
      sort: "pnode_name",
      startRow: "1",
      termination_date: "12/31/9999 exact",
    },
  });
  return rows
    .map((row) => {
      const pnodeId =
        typeof row.pnode_id === "number" && Number.isInteger(row.pnode_id) ? row.pnode_id : null;
      const pnodeName = normalizeDisplayText(row.pnode_name);
      if (pnodeId === null || pnodeName === null) {
        return null;
      }
      return {
        pnodeId,
        pnodeName,
      };
    })
    .filter((row) => row !== null);
}
function buildPjmZonePnodeContext(zonePnodes) {
  return {
    zoneLabelByPnodeId: new Map(zonePnodes.map((row) => [row.pnodeId, row.pnodeName])),
    zonePnodeIds: new Set(
      zonePnodes
        .filter((row) => row.pnodeName !== "PJM-RTO" && row.pnodeName !== "PJM")
        .map((row) => row.pnodeId)
    ),
  };
}
function buildPjmAggregateLmpState(lmpRows) {
  const congestionValues = [];
  let latestTimestamp = 0;
  let negativePriceCount = 0;
  let totalPriceCount = 0;
  for (const row of lmpRows) {
    const congestionPrice = parseOptionalNumericLike(row.congestion_price_rt);
    if (congestionPrice !== null) {
      congestionValues.push(congestionPrice);
    }
    const totalLmp = parseOptionalNumericLike(row.total_lmp_rt);
    if (totalLmp !== null) {
      totalPriceCount += 1;
      if (totalLmp < 0) {
        negativePriceCount += 1;
      }
    }
    latestTimestamp = updateMaxTimestamp(latestTimestamp, row.datetime_beginning_utc);
  }
  return {
    congestionValues,
    latestTimestamp,
    negativePriceCount,
    totalPriceCount,
  };
}
function buildPjmZonalLmpState(zoneLmpRows, zonePnodeIds, zoneLabelByPnodeId) {
  const zonalCongestionValues = new Map();
  const zonalNegativePriceCounts = new Map();
  for (const row of zoneLmpRows) {
    const pnodeId =
      typeof row.pnode_id === "number" && Number.isInteger(row.pnode_id) ? row.pnode_id : null;
    if (pnodeId === null || !zonePnodeIds.has(pnodeId)) {
      continue;
    }
    const zoneLabel = zoneLabelByPnodeId.get(pnodeId) ?? null;
    if (zoneLabel === null) {
      continue;
    }
    const congestionPrice = parseOptionalNumericLike(row.congestion_price_rt);
    if (congestionPrice !== null) {
      appendMapArrayValue(zonalCongestionValues, zoneLabel, congestionPrice);
    }
    const totalLmp = parseOptionalNumericLike(row.total_lmp_rt);
    if (totalLmp !== null) {
      recordNegativePriceCounter(zonalNegativePriceCounts, zoneLabel, totalLmp);
    }
  }
  return {
    zonalCongestionValues,
    zonalNegativePriceCounts,
  };
}
async function buildPjmOperatorCongestionSummary() {
  const aggregatePnodeId = await resolvePjmAggregatePnodeId();
  const zonePnodes = await listPjmZonePnodes();
  const { zoneLabelByPnodeId, zonePnodeIds } = buildPjmZonePnodeContext(zonePnodes);
  const lmpRows = await fetchPjmApiItems({
    feedName: "rt_unverified_fivemin_lmps",
    params: {
      datetime_beginning_ept: "yesterday",
      order: "DESC",
      pnode_id: String(aggregatePnodeId),
      rowCount: "500",
      sort: "datetime_beginning_ept",
      startRow: "1",
    },
  });
  const zoneLmpRows = await fetchPjmApiItems({
    feedName: "rt_hrl_lmps",
    params: {
      datetime_beginning_ept: "yesterday",
      order: "DESC",
      rowCount: "250000",
      row_is_current: "1",
      sort: "datetime_beginning_ept",
      startRow: "1",
    },
  });
  const constraintRows = await fetchPjmApiItems({
    feedName: "rt_marginal_value",
    params: {
      datetime_beginning_ept: "yesterday",
      order: "DESC",
      rowCount: "10000",
      sort: "datetime_beginning_ept",
      startRow: "1",
    },
  });
  const { congestionValues, latestTimestamp, negativePriceCount, totalPriceCount } =
    buildPjmAggregateLmpState(lmpRows);
  const { zonalCongestionValues, zonalNegativePriceCounts } = buildPjmZonalLmpState(
    zoneLmpRows,
    zonePnodeIds,
    zoneLabelByPnodeId
  );
  const constraintSummary = buildConstraintSummaryAggregate(
    constraintRows.map((row) => ({
      constraintId:
        normalizeDisplayText(row.monitored_facility) ??
        normalizeDisplayText(row.contingency_facility) ??
        "PJM-constraint",
      flowMw: null,
      label:
        normalizeDisplayText(row.monitored_facility) ??
        normalizeDisplayText(row.contingency_facility) ??
        "PJM constraint",
      limitMw: null,
      shadowPrice: parseOptionalNumericLike(row.shadow_price),
      voltageKv: parseVoltageKv(normalizeDisplayText(row.monitored_facility)),
    })),
    "PJM"
  );
  return {
    aggregate: {
      avgRtCongestionComponent: averageFiniteNumbers(congestionValues, 4),
      negativePriceHourShare:
        totalPriceCount === 0 ? null : roundTo(negativePriceCount / totalPriceCount, 6),
      p95ShadowPrice: constraintSummary.p95ShadowPrice,
      topConstraints: constraintSummary.topConstraints,
    },
    zonalAggregates: buildNamedZonalCongestionAggregates(
      zonalCongestionValues,
      zonalNegativePriceCounts
    ),
    sourceAsOfDate:
      latestTimestamp > 0 ? toIsoDate(new Date(latestTimestamp)) : toIsoDate(new Date()),
  };
}
function decodeTabularApiRows(payload, context) {
  if (!(isPlainRecord(payload) && Array.isArray(payload.headers) && Array.isArray(payload.data))) {
    throw new Error(`Invalid tabular payload for ${context}`);
  }
  const headers = payload.headers.map(
    (value, index) =>
      normalizeDisplayText(typeof value === "string" ? value : null) ??
      `column_${String(index + 1)}`
  );
  return payload.data
    .filter((row) => Array.isArray(row))
    .map((row) =>
      headers.reduce((record, header, index) => {
        record[header] = row[index];
        return record;
      }, {})
    );
}
function resolveMisoTransmissionPricingZone(value) {
  const normalized = normalizeDisplayText(value);
  if (normalized === null) {
    return null;
  }
  const zoneToken = normalized.split(".")[0] ?? null;
  const transmissionPricingZone = normalizeDisplayText(zoneToken)?.toUpperCase() ?? null;
  return transmissionPricingZone;
}
async function buildMisoOperatorCongestionSummary() {
  const lmpRows = decodeTabularApiRows(
    await fetchJson(`${MISO_PUBLIC_API_BASE_URL}/MarketPricing/GetRealTimeFiveMinExPost/Current`),
    "MISO real-time five minute ex post"
  );
  const constraintPayload = await fetchJson(
    `${MISO_PUBLIC_API_BASE_URL}/BindingConstraints/RealTime`
  );
  if (!(isPlainRecord(constraintPayload) && Array.isArray(constraintPayload.Constraint))) {
    throw new Error("Invalid MISO binding constraints payload");
  }
  const constraintRows = constraintPayload.Constraint.filter((row) => isPlainRecord(row));
  const congestionValues = [];
  const zonalCongestionValues = new Map();
  let latestTimestamp = 0;
  const zonalNegativePriceCounts = new Map();
  for (const row of lmpRows) {
    const congestionPrice = parseOptionalNumericLike(row.MCC);
    if (congestionPrice !== null) {
      congestionValues.push(congestionPrice);
      const transmissionPricingZone = resolveMisoTransmissionPricingZone(row.CPNODE);
      const localResourceZone =
        transmissionPricingZone === null
          ? null
          : (MISO_TRANSMISSION_PRICING_ZONE_TO_LRZ.get(transmissionPricingZone) ?? null);
      if (localResourceZone !== null) {
        appendMapArrayValue(zonalCongestionValues, localResourceZone, congestionPrice);
      }
    }
    const totalLmp = parseOptionalNumericLike(row.LMP);
    const transmissionPricingZone = resolveMisoTransmissionPricingZone(row.CPNODE);
    const localResourceZone =
      transmissionPricingZone === null
        ? null
        : (MISO_TRANSMISSION_PRICING_ZONE_TO_LRZ.get(transmissionPricingZone) ?? null);
    if (localResourceZone !== null && totalLmp !== null) {
      recordNegativePriceCounter(zonalNegativePriceCounts, localResourceZone, totalLmp);
    }
    latestTimestamp = updateMaxTimestamp(latestTimestamp, row.INTERVAL);
  }
  const constraintSummary = buildConstraintSummaryAggregate(
    constraintRows.map((row) => ({
      constraintId: normalizeDisplayText(row.Name) ?? "MISO-constraint",
      flowMw: null,
      label: normalizeDisplayText(row.Name) ?? "MISO constraint",
      limitMw: parseOptionalNumericLike(row.PC1),
      shadowPrice: parseOptionalNumericLike(row.Price),
      voltageKv: parseVoltageKv(normalizeDisplayText(row.Name)),
    })),
    "MISO"
  );
  latestTimestamp = updateMaxTimestamp(
    latestTimestamp,
    isPlainRecord(constraintPayload) ? constraintPayload.RefId : null
  );
  return {
    aggregate: {
      avgRtCongestionComponent: averageFiniteNumbers(congestionValues, 4),
      negativePriceHourShare: null,
      p95ShadowPrice: constraintSummary.p95ShadowPrice,
      topConstraints: constraintSummary.topConstraints,
    },
    zonalAggregates: buildNamedZonalCongestionAggregates(
      zonalCongestionValues,
      zonalNegativePriceCounts
    ),
    sourceAsOfDate:
      latestTimestamp > 0 ? toIsoDate(new Date(latestTimestamp)) : toIsoDate(new Date()),
  };
}
function selectLatestErcotDocuments(args) {
  return args.documents
    .map((document) => ({
      docId: normalizeDisplayText(document.DocID),
      friendlyName: normalizeDisplayText(document.FriendlyName),
      publishDate: normalizeDisplayText(document.PublishDate),
    }))
    .filter(
      (document) =>
        document.docId !== null &&
        document.friendlyName !== null &&
        document.publishDate !== null &&
        document.friendlyName.endsWith(args.friendlyNameSuffix)
    )
    .sort((left, right) => Date.parse(right.publishDate) - Date.parse(left.publishDate))
    .slice(0, args.limit)
    .map((document) => ({
      docId: document.docId,
      friendlyName: document.friendlyName,
      publishDate: document.publishDate,
    }));
}
async function downloadErcotDocumentText(args) {
  const zipPath = join(args.rawDir, `${args.filePrefix}-${args.docId}.zip`);
  await downloadFile(
    `${ERCOT_MIS_DOWNLOAD_URL}?${new URLSearchParams({
      doclookupId: args.docId,
    }).toString()}`,
    zipPath
  );
  return readZipTextFile(zipPath);
}
function buildErcotQuarterHourKey(args) {
  const normalizedDate = normalizeDisplayText(args.dateValue);
  const normalizedTime = normalizeDisplayText(args.timeValue);
  if (normalizedDate === null || normalizedTime === null) {
    return null;
  }
  let compactDate = normalizedDate.replaceAll("-", "").replaceAll("/", "");
  if (ERCOT_US_DATE_PATTERN.test(normalizedDate)) {
    const [month, day, year] = normalizedDate.split("/");
    if (month && day && year) {
      compactDate = `${year}${month.padStart(2, "0")}${day.padStart(2, "0")}`;
    }
  }
  if (!ERCOT_NUMERIC_DATE_PATTERN.test(compactDate)) {
    return null;
  }
  const timeDigits = normalizedTime.replaceAll(":", "");
  if (!(timeDigits.length === 4 || timeDigits.length === 6)) {
    return null;
  }
  const hour = Number.parseInt(timeDigits.slice(0, 2), 10);
  const minute = Number.parseInt(timeDigits.slice(2, 4), 10);
  if (
    !(Number.isFinite(hour) && Number.isFinite(minute)) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  const quarterMinute = Math.floor(minute / 15) * 15;
  return `${compactDate}_${String(hour).padStart(2, "0")}${String(quarterMinute).padStart(2, "0")}`;
}
function buildErcotQuarterHourKeyFromFriendlyName(friendlyName) {
  const normalizedFriendlyName = normalizeDisplayText(friendlyName);
  if (normalizedFriendlyName === null) {
    return null;
  }
  const parts = normalizedFriendlyName.split("_");
  if (parts.length < 3) {
    return null;
  }
  return buildErcotQuarterHourKey({
    dateValue: parts.at(-3) ?? null,
    timeValue: parts.at(-2) ?? null,
  });
}
function parseErcotSystemLambdaObservation(csvContent) {
  const row = parseCsvRecordsWithHeaderLine(csvContent, 0)[0];
  if (!row) {
    return null;
  }
  const normalizedTimestamp = normalizeDisplayText(row.SCEDTimeStamp);
  const [dateValue, timeValue] = normalizedTimestamp?.split(" ") ?? [];
  const bucketKey = buildErcotQuarterHourKey({
    dateValue: dateValue ?? null,
    timeValue: timeValue ?? null,
  });
  const systemLambda = parseOptionalNumericLike(row.SystemLambda);
  if (bucketKey === null || systemLambda === null) {
    return null;
  }
  return {
    bucketKey,
    systemLambda,
  };
}
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ERCOT congestion extraction must reconcile multiple public report families in a single canonical path.
async function buildErcotOperatorCongestionSummary(args) {
  const settlementDocuments = selectLatestErcotDocuments({
    documents: await fetchErcotReportList(ERCOT_SETTLEMENT_POINT_PRICE_REPORT_TYPE_ID),
    friendlyNameSuffix: "_csv",
    limit: 96,
  });
  const lambdaDocuments = selectLatestErcotDocuments({
    documents: await fetchErcotReportList(ERCOT_SCED_SYSTEM_LAMBDA_REPORT_TYPE_ID),
    friendlyNameSuffix: "_csv",
    limit: Math.max(settlementDocuments.length * 3 + 12, 96),
  });
  const constraintDocuments = selectLatestErcotDocuments({
    documents: await fetchErcotReportList(ERCOT_SCED_CONSTRAINT_REPORT_TYPE_ID),
    friendlyNameSuffix: "_csv",
    limit: 24,
  });
  let loadZoneObservationCount = 0;
  let latestTimestamp = 0;
  const congestionSpreadValues = [];
  let negativeLoadZoneCount = 0;
  const systemLambdaValuesByBucket = new Map();
  for (const document of lambdaDocuments) {
    const csvContent = await downloadErcotDocumentText({
      docId: document.docId,
      filePrefix: "ercot-sced-system-lambda",
      rawDir: args.rawDir,
    });
    const observation = parseErcotSystemLambdaObservation(csvContent);
    if (observation === null) {
      continue;
    }
    const values = systemLambdaValuesByBucket.get(observation.bucketKey) ?? [];
    values.push(observation.systemLambda);
    systemLambdaValuesByBucket.set(observation.bucketKey, values);
    latestTimestamp = updateMaxTimestamp(latestTimestamp, document.publishDate);
  }
  const averageSystemLambdaByBucket = new Map(
    [...systemLambdaValuesByBucket.entries()]
      .map(([bucketKey, values]) => ({
        bucketKey,
        value: averageFiniteNumbers(values, 6),
      }))
      .filter((entry) => entry.value !== null)
      .map((entry) => [entry.bucketKey, entry.value])
  );
  for (const document of settlementDocuments) {
    const csvContent = await downloadErcotDocumentText({
      docId: document.docId,
      filePrefix: "ercot-settlement-point-prices",
      rawDir: args.rawDir,
    });
    const rows = parseCsvRecordsWithHeaderLine(csvContent, 0);
    const bucketKey = buildErcotQuarterHourKeyFromFriendlyName(document.friendlyName);
    const systemLambda =
      bucketKey === null ? null : (averageSystemLambdaByBucket.get(bucketKey) ?? null);
    for (const row of rows) {
      if (normalizeDisplayText(row.SettlementPointType) !== "LZ") {
        continue;
      }
      const settlementPointPrice = parseOptionalNumericLike(row.SettlementPointPrice);
      if (settlementPointPrice === null) {
        continue;
      }
      loadZoneObservationCount += 1;
      if (settlementPointPrice < 0) {
        negativeLoadZoneCount += 1;
      }
      if (typeof systemLambda === "number") {
        congestionSpreadValues.push(settlementPointPrice - systemLambda);
      }
    }
    latestTimestamp = updateMaxTimestamp(latestTimestamp, document.publishDate);
  }
  const constraintEntries = [];
  for (const document of constraintDocuments) {
    const csvContent = await downloadErcotDocumentText({
      docId: document.docId,
      filePrefix: "ercot-sced-constraints",
      rawDir: args.rawDir,
    });
    const rows = parseCsvRecordsWithHeaderLine(csvContent, 0);
    for (const row of rows) {
      const fromVoltageKv = parseOptionalNumericLike(row.FromStationkV);
      const toVoltageKv = parseOptionalNumericLike(row.ToStationkV);
      constraintEntries.push({
        constraintId:
          normalizeDisplayText(row.ConstraintID) ?? normalizeDisplayText(row.ConstraintName),
        flowMw: parseOptionalNumericLike(row.Value),
        label: normalizeDisplayText(row.ConstraintName) ?? "ERCOT constraint",
        limitMw: parseOptionalNumericLike(row.Limit),
        shadowPrice: parseOptionalNumericLike(row.ShadowPrice),
        voltageKv:
          typeof fromVoltageKv === "number" || typeof toVoltageKv === "number"
            ? Math.max(fromVoltageKv ?? 0, toVoltageKv ?? 0)
            : null,
      });
    }
    latestTimestamp = updateMaxTimestamp(latestTimestamp, document.publishDate);
  }
  const constraintSummary = buildConstraintSummaryAggregate(constraintEntries, "ERCOT");
  return {
    aggregate: {
      avgRtCongestionComponent: averageFiniteNumbers(congestionSpreadValues, 4),
      negativePriceHourShare:
        loadZoneObservationCount === 0
          ? null
          : roundTo(negativeLoadZoneCount / loadZoneObservationCount, 6),
      p95ShadowPrice: constraintSummary.p95ShadowPrice,
      topConstraints: constraintSummary.topConstraints,
    },
    sourceAsOfDate: latestTimestamp > 0 ? toIsoDate(new Date(latestTimestamp)) : args.effectiveDate,
  };
}
function createGridFrictionQueueAggregate() {
  return {
    activeDays: [],
    pastDueCount: 0,
    plannedTransmissionUpgradeCount: 0,
    statuses: new Map(),
    totalRows: 0,
    totalWithdrawalPrior: 0,
    totalWithdrawalPriorCount: 0,
  };
}
function calculateMedianActiveDays(values) {
  if (values.length === 0) {
    return null;
  }
  const sortedValues = [...values].sort((left, right) => left - right);
  const midpointIndex = Math.floor(sortedValues.length / 2);
  if (sortedValues.length % 2 === 1) {
    return sortedValues[midpointIndex] ?? null;
  }
  return roundTo(
    ((sortedValues[midpointIndex - 1] ?? 0) + (sortedValues[midpointIndex] ?? 0)) / 2,
    2
  );
}
function buildGridFrictionStatusMix(statuses) {
  return [...(statuses?.entries() ?? [])].reduce((result, entry) => {
    const [status, count] = entry;
    result[status] = count;
    return result;
  }, {});
}
function determineGridFrictionConfidence(args) {
  if (args.queue !== undefined && args.congestion !== undefined) {
    return "high";
  }
  if (args.queue !== undefined || args.congestion !== undefined) {
    return "medium";
  }
  return null;
}
function buildCountyGridFrictionRecord(args) {
  return {
    confidence: determineGridFrictionConfidence({
      congestion: args.congestion,
      queue: args.queue,
    }),
    congestionProxyScore: args.scoreMap.get(args.countyFips) ?? null,
    countyFips: args.countyFips,
    heatmapSignalAvailable:
      args.congestion === undefined
        ? null
        : args.congestion.topConstraints.length > 0 ||
          args.congestion.avgRtCongestionComponent !== null,
    marketWithdrawalPrior:
      args.queue === undefined || args.queue.totalWithdrawalPriorCount === 0
        ? null
        : roundTo(args.queue.totalWithdrawalPrior / args.queue.totalWithdrawalPriorCount, 6),
    medianDaysInQueueActive:
      args.queue === undefined ? null : calculateMedianActiveDays(args.queue.activeDays),
    pastDueShare:
      args.queue === undefined || args.queue.totalRows === 0
        ? null
        : roundTo(args.queue.pastDueCount / args.queue.totalRows, 6),
    plannedTransmissionUpgradeCount:
      args.queue === undefined ? null : args.queue.plannedTransmissionUpgradeCount,
    statusMix: buildGridFrictionStatusMix(args.queue?.statuses),
  };
}
function buildCountyGridFrictionRecords(args) {
  const queueMap = new Map();
  for (const record of args.queueSnapshots) {
    if (record.countyFips === null) {
      continue;
    }
    const existing = queueMap.get(record.countyFips) ?? createGridFrictionQueueAggregate();
    const queueStatus = record.queueStatus ?? "unknown";
    existing.statuses.set(queueStatus, (existing.statuses.get(queueStatus) ?? 0) + 1);
    existing.totalRows += 1;
    if (record.isPastDue) {
      existing.pastDueCount += 1;
    }
    if (typeof record.withdrawalPrior === "number") {
      existing.totalWithdrawalPrior += record.withdrawalPrior;
      existing.totalWithdrawalPriorCount += 1;
    }
    if (typeof record.transmissionUpgradeCount === "number") {
      existing.plannedTransmissionUpgradeCount += record.transmissionUpgradeCount;
    }
    if (
      typeof record.daysInQueueActive === "number" &&
      (record.queueStatus ?? "") !== "withdrawn" &&
      (record.queueStatus ?? "") !== "cancelled" &&
      (record.queueStatus ?? "") !== "complete"
    ) {
      existing.activeDays.push(record.daysInQueueActive);
    }
    queueMap.set(record.countyFips, existing);
  }
  const congestionMap = new Map(
    args.congestionRecords.map((record) => [record.countyFips, record])
  );
  const counties = [...dedupeStrings([...queueMap.keys(), ...congestionMap.keys()])].sort(
    (left, right) => left.localeCompare(right)
  );
  const rawScores = counties
    .map((countyFips) => {
      const congestion = congestionMap.get(countyFips);
      if (
        typeof congestion?.avgRtCongestionComponent !== "number" &&
        typeof congestion?.p95ShadowPrice !== "number"
      ) {
        return null;
      }
      return {
        countyFips,
        value:
          Math.abs(congestion?.avgRtCongestionComponent ?? 0) +
          Math.log1p(Math.max(congestion?.p95ShadowPrice ?? 0, 0)),
      };
    })
    .filter((value) => value !== null)
    .sort((left, right) => left.value - right.value);
  const scoreMap = new Map();
  rawScores.forEach((entry, index) => {
    const denominator = Math.max(1, rawScores.length - 1);
    scoreMap.set(entry.countyFips, roundTo((index / denominator) * 100, 4));
  });
  return counties.map((countyFips) =>
    buildCountyGridFrictionRecord({
      congestion: congestionMap.get(countyFips),
      countyFips,
      queue: queueMap.get(countyFips),
      scoreMap,
    })
  );
}
function readYesNoFlag(value) {
  return normalizeDisplayText(value)?.toLowerCase() === "yes";
}
function normalizePolicyProgramStatus(value) {
  const normalized = normalizeDisplayText(value)?.toLowerCase() ?? null;
  if (normalized === null) {
    return null;
  }
  if (normalized.includes("active")) {
    return "active";
  }
  if (normalized.includes("announced")) {
    return "announced";
  }
  if (normalized.includes("inactive") || normalized.includes("close")) {
    return "inactive";
  }
  return normalized;
}
function normalizeCommunitySolarPolicyStatus(value) {
  const normalized = normalizeDisplayText(value)?.toLowerCase() ?? null;
  if (normalized === null) {
    return null;
  }
  return normalized.startsWith("active") ? "active" : normalized;
}
function createStatePolicyAggregate() {
  return {
    activePolicyCount: 0,
    activeProgramCount: 0,
    hasInstalledProjects: false,
    hasLegislation: false,
    recentActivePolicyCount: 0,
  };
}
function createDefaultCountyPolicySnapshot(countyFips) {
  return {
    countyFips,
    countyTaggedEventShare: 0,
    moratoriumStatus: "unknown",
    policyConstraintScore: 100,
    policyEventCount: 0,
    policyMappingConfidence: "low",
    policyMomentumScore: null,
    publicSentimentScore: null,
  };
}
function calculatePolicyConstraintScore(aggregate) {
  let supportPoints = 0;
  if (aggregate.hasInstalledProjects) {
    supportPoints += 40;
  }
  if (aggregate.hasLegislation) {
    supportPoints += 30;
  }
  supportPoints += Math.min(aggregate.activeProgramCount, 3) * 10;
  supportPoints += Math.min(aggregate.activePolicyCount, 4) * 5;
  return roundTo(Math.max(0, 100 - Math.min(supportPoints, 100)), 4);
}
function calculatePolicyMomentumScore(aggregate) {
  if (aggregate.recentActivePolicyCount === 0 && aggregate.activeProgramCount === 0) {
    return null;
  }
  return roundTo(
    Math.min(100, aggregate.recentActivePolicyCount * 20 + aggregate.activeProgramCount * 5),
    4
  );
}
function buildCountyPolicySnapshot(args) {
  if (typeof args.aggregate === "undefined") {
    return createDefaultCountyPolicySnapshot(args.countyFips);
  }
  return {
    countyFips: args.countyFips,
    countyTaggedEventShare: 0,
    moratoriumStatus: "unknown",
    policyConstraintScore: calculatePolicyConstraintScore(args.aggregate),
    policyEventCount: args.aggregate.activePolicyCount,
    policyMappingConfidence: "low",
    policyMomentumScore: calculatePolicyMomentumScore(args.aggregate),
    publicSentimentScore: null,
  };
}
function normalizeCommunitySolarEventDate(year) {
  return `${String(year).padStart(4, "0")}-01-01`;
}
function buildCommunitySolarPolicyEvidenceSummary(args) {
  const details = [
    args.policyCategory === null ? null : `Category: ${args.policyCategory}.`,
    args.relatedProgram === null ? null : `Related program: ${args.relatedProgram}.`,
    "Source workbook provides year-level policy timing; event date normalized to January 1 of the listed year.",
  ].filter((value) => value !== null);
  return details.join(" ");
}
function readCommunitySolarPolicyWorkbook(workbookPath) {
  return {
    policyRows: readWorkbookRecords({
      firstDataRowIndex: 1,
      headerRowIndexes: [0],
      sheetName: "Policies",
      workbookPath,
    }),
    stateProgramRows: readWorkbookRecords({
      firstDataRowIndex: 1,
      headerRowIndexes: [0],
      sheetName: "State_Program",
      workbookPath,
    }),
  };
}
function applyCommunitySolarStateProgramRows(stateAggregates, stateProgramRows) {
  for (const row of stateProgramRows) {
    const stateAbbrev = normalizeDisplayText(row["State or Territory"]);
    if (stateAbbrev === null || stateAbbrev.length !== 2) {
      continue;
    }
    const aggregate = stateAggregates.get(stateAbbrev) ?? createStatePolicyAggregate();
    if (readYesNoFlag(row["State has Installed Community Solar Projects"])) {
      aggregate.hasInstalledProjects = true;
    }
    if (readYesNoFlag(row["State has Community Solar Legislation"])) {
      aggregate.hasLegislation = true;
    }
    const programStatus = normalizePolicyProgramStatus(row["Program Status"]);
    if (programStatus === "active" || programStatus === "announced") {
      aggregate.activeProgramCount += 1;
    }
    stateAggregates.set(stateAbbrev, aggregate);
  }
}
function buildCommunitySolarPolicyEvents(args) {
  const policyEvents = [];
  for (const row of args.policyRows) {
    const stateAbbrev = normalizeDisplayText(row.State);
    const title = normalizeDisplayText(row.Policy);
    const year = readOptionalYear(row.Year);
    if (stateAbbrev === null || stateAbbrev.length !== 2 || title === null || year === null) {
      continue;
    }
    const aggregate = args.stateAggregates.get(stateAbbrev) ?? createStatePolicyAggregate();
    const policyStatus = normalizeCommunitySolarPolicyStatus(row["Policy Status"]);
    if (policyStatus === "active") {
      aggregate.activePolicyCount += 1;
      if (year >= args.currentYear - 2) {
        aggregate.recentActivePolicyCount += 1;
      }
    }
    args.stateAggregates.set(stateAbbrev, aggregate);
    policyEvents.push({
      affectedSitingDimension: "generation_siting",
      countyFips: null,
      confidenceClass: "unknown",
      eventDate: normalizeCommunitySolarEventDate(year),
      eventId: `nrel-community-solar:${stateAbbrev}:${year}:${slugifyText(normalizeDisplayText(row["Policy Category"]) ?? "community-solar-policy")}:${slugifyText(title)}`,
      eventType: slugifyText(
        normalizeDisplayText(row["Policy Category"]) ?? "community-solar-policy"
      ),
      evidenceSummary: buildCommunitySolarPolicyEvidenceSummary({
        policyCategory: normalizeDisplayText(row["Policy Category"]),
        relatedProgram: normalizeDisplayText(row["Related Program"]),
      }),
      jurisdictionKey: stateAbbrev,
      jurisdictionLevel: "state",
      marketId: null,
      moratoriumStatus: null,
      policyDirection: "supportive",
      policyStatus,
      policyType: "community_solar",
      sentimentDirection: null,
      sourceUrl: normalizeDisplayText(row.Link),
      stateAbbrev,
      title,
    });
  }
  return policyEvents;
}
function buildCommunitySolarPolicyRecords(args) {
  const { policyRows, stateProgramRows } = readCommunitySolarPolicyWorkbook(args.workbookPath);
  const stateAggregates = new Map();
  applyCommunitySolarStateProgramRows(stateAggregates, stateProgramRows);
  const currentYear = Number(args.effectiveDate.slice(0, 4));
  const policyEvents = buildCommunitySolarPolicyEvents({
    currentYear,
    policyRows,
    stateAggregates,
  });
  const policySnapshots = args.countyEntries.map((county) =>
    buildCountyPolicySnapshot({
      aggregate: stateAggregates.get(county.stateAbbrev),
      countyFips: county.countyFips,
    })
  );
  return {
    policyEvents,
    policySnapshots,
  };
}
async function fetchTransmissionServiceMetadata() {
  const serviceRootRaw = await fetchJson(`${TRANSMISSION_SERVICE_URL}?f=pjson`);
  const serviceRoot = isPlainRecord(serviceRootRaw) ? serviceRootRaw : null;
  if (serviceRoot === null) {
    throw new Error("Invalid transmission service metadata payload");
  }
  const layersValue = serviceRoot.layers;
  if (!Array.isArray(layersValue) || layersValue.length === 0) {
    throw new Error("Transmission service does not expose any feature layers");
  }
  const firstLayer = layersValue[0];
  if (!isPlainRecord(firstLayer)) {
    throw new Error("Invalid transmission service layer descriptor");
  }
  const layerIdRaw = firstLayer.id;
  if (typeof layerIdRaw !== "number" || !Number.isInteger(layerIdRaw)) {
    throw new Error("Transmission service layer is missing an integer id");
  }
  const layerRaw = await fetchJson(`${TRANSMISSION_SERVICE_URL}/${String(layerIdRaw)}?f=pjson`);
  const layer = isPlainRecord(layerRaw) ? layerRaw : null;
  if (layer === null) {
    throw new Error("Invalid transmission layer metadata payload");
  }
  const maxRecordCount =
    typeof layer.maxRecordCount === "number" && Number.isInteger(layer.maxRecordCount)
      ? layer.maxRecordCount
      : 1000;
  const objectIdField =
    typeof layer.objectIdField === "string" && layer.objectIdField.length > 0
      ? layer.objectIdField
      : "OBJECTID_1";
  const editingInfo = isPlainRecord(layer.editingInfo) ? layer.editingInfo : null;
  return {
    layerId: layerIdRaw,
    maxRecordCount,
    objectIdField,
    sourceAsOfDate: formatSourceAsOfDate(
      editingInfo !== null && typeof editingInfo.dataLastEditDate === "number"
        ? editingInfo.dataLastEditDate
        : null,
      toIsoDate(new Date())
    ),
  };
}
async function fetchTransmissionFeatureCount(metadata) {
  const countRaw = await fetchJson(
    `${TRANSMISSION_SERVICE_URL}/${String(metadata.layerId)}/query?where=1%3D1&returnCountOnly=true&f=pjson`
  );
  const countRecord = isPlainRecord(countRaw) ? countRaw : null;
  if (countRecord === null || typeof countRecord.count !== "number") {
    throw new Error("Invalid transmission count response");
  }
  return countRecord.count;
}
function normalizeTransmissionFeature(value) {
  if (!isPlainRecord(value)) {
    throw new Error("Invalid transmission feature");
  }
  const geometryRecord = isPlainRecord(value.geometry) ? value.geometry : null;
  const propertiesRecord = isPlainRecord(value.properties) ? value.properties : null;
  if (geometryRecord === null || propertiesRecord === null || value.type !== "Feature") {
    throw new Error("Transmission feature is missing geometry or properties");
  }
  const geometryType =
    typeof geometryRecord.type === "string" && geometryRecord.type.length > 0
      ? geometryRecord.type
      : null;
  const coordinates = Array.isArray(geometryRecord.coordinates) ? geometryRecord.coordinates : null;
  if (geometryType === null || coordinates === null) {
    throw new Error("Transmission feature geometry is invalid");
  }
  const objectIdRaw = propertiesRecord.OBJECTID_1;
  const voltageRaw = propertiesRecord.VOLTAGE;
  return {
    geometry: {
      coordinates,
      type: geometryType,
    },
    properties: {
      ID:
        typeof propertiesRecord.ID === "string" && propertiesRecord.ID.trim().length > 0
          ? propertiesRecord.ID.trim()
          : null,
      OBJECTID_1:
        typeof objectIdRaw === "number" && Number.isFinite(objectIdRaw) ? objectIdRaw : null,
      OWNER:
        typeof propertiesRecord.OWNER === "string" && propertiesRecord.OWNER.trim().length > 0
          ? propertiesRecord.OWNER.trim()
          : null,
      VOLTAGE: typeof voltageRaw === "number" && Number.isFinite(voltageRaw) ? voltageRaw : null,
      VOLT_CLASS:
        typeof propertiesRecord.VOLT_CLASS === "string" &&
        propertiesRecord.VOLT_CLASS.trim().length > 0
          ? propertiesRecord.VOLT_CLASS.trim()
          : null,
    },
    type: "Feature",
  };
}
async function fetchTransmissionFeaturePage(args) {
  const url =
    `${TRANSMISSION_SERVICE_URL}/${String(args.metadata.layerId)}/query?` +
    "where=1%3D1" +
    `&outFields=${encodeURIComponent("OBJECTID_1,ID,VOLTAGE,VOLT_CLASS,OWNER")}` +
    "&returnGeometry=true" +
    "&outSR=4326" +
    "&orderByFields=OBJECTID_1" +
    `&resultOffset=${String(args.offset)}` +
    `&resultRecordCount=${String(args.metadata.maxRecordCount)}` +
    "&f=geojson";
  const raw = await fetchJson(url);
  const record = isPlainRecord(raw) ? raw : null;
  if (record === null || !Array.isArray(record.features)) {
    throw new Error("Invalid transmission page response");
  }
  return record.features.map(normalizeTransmissionFeature);
}
async function buildCountyTransmissionRecords(countyEntries) {
  const metadata = await fetchTransmissionServiceMetadata();
  const featureCount = await fetchTransmissionFeatureCount(metadata);
  const totalPages = Math.ceil(featureCount / metadata.maxRecordCount);
  const pageConcurrency = 5;
  console.log(
    `[county-power] transmission extract starting (${String(featureCount)} features across ${String(totalPages)} pages)`
  );
  await bunRuntime.sql
    .unsafe(`
    DROP TABLE IF EXISTS county_power_public_us_transmission_stage
  `)
    .execute();
  await bunRuntime.sql
    .unsafe(`
    DROP TABLE IF EXISTS county_power_public_us_county_stage
  `)
    .execute();
  await bunRuntime.sql
    .unsafe(`
    CREATE TEMP TABLE county_power_public_us_county_stage AS
    SELECT
      county.county_fips AS county_geoid,
      ST_Transform(county.geom, 5070) AS geom_5070
    FROM serve.boundary_county_geom_lod1 AS county
  `)
    .execute();
  await bunRuntime.sql
    .unsafe(`
    CREATE INDEX county_power_public_us_county_stage_geom_idx
      ON county_power_public_us_county_stage
      USING GIST (geom_5070)
  `)
    .execute();
  await bunRuntime.sql
    .unsafe(`
    ANALYZE county_power_public_us_county_stage
  `)
    .execute();
  await bunRuntime.sql
    .unsafe(`
    CREATE TEMP TABLE county_power_public_us_transmission_stage (
      object_id integer PRIMARY KEY,
      line_id text,
      owner_name text,
      voltage_kv numeric,
      voltage_class text,
      geom_5070 geometry(MultiLineString, 5070) NOT NULL
    )
  `)
    .execute();
  for (
    let batchStartOffset = 0;
    batchStartOffset < featureCount;
    batchStartOffset += metadata.maxRecordCount * pageConcurrency
  ) {
    const offsets = [];
    for (
      let offset = batchStartOffset;
      offset < featureCount &&
      offset < batchStartOffset + metadata.maxRecordCount * pageConcurrency;
      offset += metadata.maxRecordCount
    ) {
      offsets.push(offset);
    }
    const pages = await Promise.all(
      offsets.map((offset) =>
        fetchTransmissionFeaturePage({
          metadata,
          offset,
        })
      )
    );
    for (const features of pages) {
      if (features.length === 0) {
        continue;
      }
      await bunRuntime.sql
        .unsafe(
          `
          INSERT INTO county_power_public_us_transmission_stage (
          object_id,
          line_id,
          owner_name,
          voltage_kv,
          voltage_class,
          geom_5070
        )
          SELECT
            NULLIF(feature->'properties'->>'OBJECTID_1', '')::integer AS object_id,
            NULLIF(feature->'properties'->>'ID', '')::text AS line_id,
            NULLIF(feature->'properties'->>'OWNER', '')::text AS owner_name,
            CASE
              WHEN NULLIF(feature->'properties'->>'VOLTAGE', '') IS NULL THEN NULL::numeric
              ELSE (feature->'properties'->>'VOLTAGE')::numeric
            END AS voltage_kv,
            NULLIF(feature->'properties'->>'VOLT_CLASS', '')::text AS voltage_class,
            ST_Multi(
              ST_Transform(
                ST_SetSRID(
                  ST_GeomFromGeoJSON((feature->'geometry')::text),
                  4326
                ),
                5070
              )
            ) AS geom_5070
          FROM jsonb_array_elements(($1::jsonb)->'features') AS feature
        `,
          [
            {
              features,
            },
          ]
        )
        .execute();
    }
    const fetchedFeatureCount = Math.min(
      batchStartOffset + metadata.maxRecordCount * pageConcurrency,
      featureCount
    );
    console.log(
      `[county-power] transmission extract fetched ${String(fetchedFeatureCount)}/${String(featureCount)} features`
    );
  }
  await bunRuntime.sql
    .unsafe(`
    CREATE INDEX county_power_public_us_transmission_stage_geom_idx
      ON county_power_public_us_transmission_stage
      USING GIST (geom_5070)
  `)
    .execute();
  await bunRuntime.sql
    .unsafe(`
    ANALYZE county_power_public_us_transmission_stage
  `)
    .execute();
  console.log("[county-power] transmission county rollup query starting");
  const aggregateResult = await bunRuntime.sql
    .unsafe(`
    WITH county_segments AS (
      SELECT
        county.county_geoid,
        CASE
          WHEN stage.voltage_kv IS NOT NULL AND stage.voltage_kv > 0 THEN stage.voltage_kv
          ELSE NULL::numeric
        END AS voltage_kv,
        ST_Length(
          ST_Intersection(county.geom_5070, stage.geom_5070)
        ) / 1609.344 AS segment_miles
      FROM county_power_public_us_county_stage AS county
      JOIN county_power_public_us_transmission_stage AS stage
        ON stage.geom_5070 && county.geom_5070
       AND ST_Intersects(stage.geom_5070, county.geom_5070)
    )
    SELECT
      county.county_geoid,
      ROUND(
        COALESCE(SUM(CASE WHEN county_segments.voltage_kv >= 69 THEN county_segments.segment_miles ELSE 0 END), 0)::numeric,
        2
      ) AS miles_69kv_plus,
      ROUND(
        COALESCE(SUM(CASE WHEN county_segments.voltage_kv >= 138 THEN county_segments.segment_miles ELSE 0 END), 0)::numeric,
        2
      ) AS miles_138kv_plus,
      ROUND(
        COALESCE(SUM(CASE WHEN county_segments.voltage_kv >= 230 THEN county_segments.segment_miles ELSE 0 END), 0)::numeric,
        2
      ) AS miles_230kv_plus,
      ROUND(
        COALESCE(SUM(CASE WHEN county_segments.voltage_kv >= 345 THEN county_segments.segment_miles ELSE 0 END), 0)::numeric,
        2
      ) AS miles_345kv_plus,
      ROUND(
        COALESCE(SUM(CASE WHEN county_segments.voltage_kv >= 500 THEN county_segments.segment_miles ELSE 0 END), 0)::numeric,
        2
      ) AS miles_500kv_plus,
      ROUND(
        COALESCE(SUM(CASE WHEN county_segments.voltage_kv >= 765 THEN county_segments.segment_miles ELSE 0 END), 0)::numeric,
        2
      ) AS miles_765kv_plus
    FROM county_power_public_us_county_stage AS county
    LEFT JOIN county_segments
      ON county_segments.county_geoid = county.county_geoid
    GROUP BY county.county_geoid
    ORDER BY county.county_geoid
  `)
    .execute();
  const rows = readUnknownRecordArray(aggregateResult);
  const rowMap = new Map();
  for (const row of rows) {
    const countyFips = normalizeDisplayText(
      typeof row.county_geoid === "string" ? row.county_geoid : null
    );
    if (countyFips === null) {
      throw new Error("Transmission aggregate row is missing county_geoid");
    }
    rowMap.set(countyFips, {
      countyFips,
      miles138kvPlus: Number(row.miles_138kv_plus ?? 0),
      miles230kvPlus: Number(row.miles_230kv_plus ?? 0),
      miles345kvPlus: Number(row.miles_345kv_plus ?? 0),
      miles500kvPlus: Number(row.miles_500kv_plus ?? 0),
      miles69kvPlus: Number(row.miles_69kv_plus ?? 0),
      miles765kvPlus: Number(row.miles_765kv_plus ?? 0),
    });
  }
  const records = countyEntries.map((county) => {
    const existing = rowMap.get(county.countyFips);
    return (
      existing ?? {
        countyFips: county.countyFips,
        miles138kvPlus: 0,
        miles230kvPlus: 0,
        miles345kvPlus: 0,
        miles500kvPlus: 0,
        miles69kvPlus: 0,
        miles765kvPlus: 0,
      }
    );
  });
  await bunRuntime.sql
    .unsafe(`
    DROP TABLE IF EXISTS county_power_public_us_transmission_stage
  `)
    .execute();
  await bunRuntime.sql
    .unsafe(`
    DROP TABLE IF EXISTS county_power_public_us_county_stage
  `)
    .execute();
  console.log("[county-power] transmission county rollup complete");
  return {
    records,
    sourceAsOfDate: metadata.sourceAsOfDate,
  };
}
async function buildCountyGasRecords(args) {
  const workbookPath = join(args.rawDir, "npms-active-pipe-county-mileage.xlsx");
  const response = await fetchWithTimeout(NPMS_ACTIVE_PIPE_COUNTY_MILEAGE_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to download ${NPMS_ACTIVE_PIPE_COUNTY_MILEAGE_URL}: ${String(response.status)} ${response.statusText}`
    );
  }
  const sourceAsOfDate = formatSourceAsOfDate(
    Date.parse(response.headers.get("last-modified") ?? ""),
    args.effectiveDate
  );
  ensureDirectory(dirname(workbookPath));
  await bunRuntime.write(workbookPath, await response.arrayBuffer());

  const countyFipsSet = new Set(args.countyEntries.map((county) => county.countyFips));
  const gasMileageByCountyFips = new Map();
  const rows = readWorkbookRecords({
    firstDataRowIndex: 1,
    headerRowIndexes: [0],
    sheetName: "Summary By County",
    workbookPath,
  });

  for (const row of rows) {
    const rawCountyFips = normalizeDisplayText(row.FIPS);
    if (rawCountyFips === null) {
      continue;
    }
    const countyFips =
      expandCountyFipsAliases(args.countyFipsAliasLookup, rawCountyFips).find((candidate) =>
        countyFipsSet.has(candidate)
      ) ?? null;
    if (countyFips === null) {
      continue;
    }
    const gasTransmissionMileage = parseOptionalNumber(row["Gas Transmission Mileage"]);
    gasMileageByCountyFips.set(countyFips, roundTo(Math.max(0, gasTransmissionMileage ?? 0), 2));
  }

  return {
    records: args.countyEntries.map((county) => {
      const gasPipelineMileageCounty = gasMileageByCountyFips.get(county.countyFips) ?? 0;
      return {
        countyFips: county.countyFips,
        gasPipelineMileageCounty,
        gasPipelinePresenceFlag: gasPipelineMileageCounty > 0,
      };
    }),
    sourceAsOfDate,
  };
}
async function buildCountyFiberRecords(args) {
  const apiBaseUrl = normalizeApiBaseUrl(process.env.FIBERLOCATOR_API_BASE_URL);
  const staticToken = normalizeDisplayText(process.env.FIBERLOCATOR_STATIC_TOKEN);
  const lineIds = parseFiberLocatorLineIds(process.env.FIBERLOCATOR_LINE_IDS);
  if (apiBaseUrl === null) {
    throw new Error("FIBERLOCATOR_API_BASE_URL is required");
  }
  if (staticToken === null) {
    throw new Error("FIBERLOCATOR_STATIC_TOKEN is required");
  }
  const tocPath = "/layers/toc";
  const tocUrl = buildFiberLocatorTokenPathUrl(apiBaseUrl, staticToken, tocPath);
  const tocResponse = await fetchWithTimeout(tocUrl);
  if (!tocResponse.ok) {
    throw new Error(
      `Failed to fetch ${tocUrl}: ${String(tocResponse.status)} ${tocResponse.statusText}`
    );
  }
  const tocPayload = await tocResponse.json();
  if (!isPlainRecord(tocPayload)) {
    throw new Error("FiberLocator layers/toc response did not return an object payload");
  }
  writeJsonAtomic(join(args.rawDir, "fiberlocator-layers-toc.json"), tocPayload);
  const sourceAsOfDate = formatSourceAsOfDate(
    Date.parse(tocResponse.headers.get("date") ?? tocResponse.headers.get("last-modified") ?? ""),
    args.effectiveDate
  );
  const sourceVersion = normalizeDisplayText(tocResponse.headers.get("etag")) ?? sourceAsOfDate;
  const sourceUri = [
    buildFiberLocatorPublicPathUrl(apiBaseUrl, tocPath),
    buildFiberLocatorPublicPathUrl(apiBaseUrl, "/layers/inview/{bbox}/{branches}"),
  ].join(" | ");
  console.log("[county-power] fiber county presence query starting");
  const records = await mapWithConcurrency(
    args.countyEntries,
    FIBERLOCATOR_COUNTY_QUERY_CONCURRENCY,
    async (countyEntry, index) => {
      const payload = await fetchJson(
        buildFiberLocatorTokenPathUrl(
          apiBaseUrl,
          staticToken,
          buildFiberLocatorLayersInViewPath(lineIds, {
            east: countyEntry.bboxEast,
            north: countyEntry.bboxNorth,
            south: countyEntry.bboxSouth,
            west: countyEntry.bboxWest,
          })
        )
      );
      if (!isPlainRecord(payload)) {
        throw new Error(
          `FiberLocator inview response for ${countyEntry.countyFips} did not return an object payload`
        );
      }
      if (normalizeDisplayText(payload.status) !== "ok") {
        throw new Error(
          `FiberLocator inview response for ${countyEntry.countyFips} returned status ${String(payload.status)}`
        );
      }
      if (!Array.isArray(payload.result)) {
        throw new Error(
          `FiberLocator inview response for ${countyEntry.countyFips} did not include a result array`
        );
      }
      if ((index + 1) % 250 === 0 || index === args.countyEntries.length - 1) {
        console.log(
          `[county-power] fiber county presence queried ${String(index + 1)} / ${String(args.countyEntries.length)} counties`
        );
      }
      return {
        countyFips: countyEntry.countyFips,
        fiberPresenceFlag: payload.result.length > 0,
      };
    }
  );
  console.log("[county-power] fiber county presence query complete");
  return {
    records,
    sourceAsOfDate,
    sourceUri,
    sourceVersion,
  };
}
function writeNdjson(path, rows) {
  const content = rows.length === 0 ? "" : `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
  writeTextAtomic(path, content);
}
export async function extractCountyPowerPublicUs(options) {
  const runTimestamp = new Date();
  const generatedAt = toIsoTimestamp(runTimestamp);
  const dataVersion = toIsoDate(runTimestamp);
  const effectiveDate = dataVersion;
  const month = firstDayOfMonth(runTimestamp);
  ensureDirectory(options.rawDir);
  const eia861Source = await resolveLatestEia861Zip();
  const placesGazetteerSource = await resolveLatestPlacesGazetteerSource();
  const countySubdivisionGazetteerSource = await resolveLatestCountySubdivisionGazetteerSource();
  const communitySolarPolicySource = await resolveCommunitySolarPolicySource();
  const eiaZipPath = join(options.rawDir, `eia861-${eia861Source.year}.zip`);
  const placesGazetteerZipPath = join(
    options.rawDir,
    `census-places-gazetteer-${placesGazetteerSource.year}.zip`
  );
  const countySubdivisionGazetteerZipPath = join(
    options.rawDir,
    `census-county-subdivision-gazetteer-${countySubdivisionGazetteerSource.year}.zip`
  );
  const communitySolarPolicyWorkbookPath = join(options.rawDir, "community-solar-policy.xlsx");
  await downloadFile(eia861Source.url, eiaZipPath);
  await downloadFile(placesGazetteerSource.url, placesGazetteerZipPath);
  await downloadFile(countySubdivisionGazetteerSource.url, countySubdivisionGazetteerZipPath);
  await downloadFile(communitySolarPolicySource.url, communitySolarPolicyWorkbookPath);
  await unzipFiles({
    destinationDir: options.rawDir,
    fileNames: [
      `Utility_Data_${eia861Source.year}.xlsx`,
      `Service_Territory_${eia861Source.year}.xlsx`,
      `Balancing_Authority_${eia861Source.year}.xlsx`,
      `Delivery_Companies_${eia861Source.year}.xlsx`,
      `Sales_Ult_Cust_${eia861Source.year}.xlsx`,
    ],
    zipPath: eiaZipPath,
  });
  const utilityRows = readWorkbookRecords({
    firstDataRowIndex: 2,
    headerRowIndexes: [0, 1],
    sheetName: "States",
    workbookPath: join(options.rawDir, `Utility_Data_${eia861Source.year}.xlsx`),
  });
  const territoryUtilityRows = readWorkbookRecords({
    firstDataRowIndex: 2,
    headerRowIndexes: [0, 1],
    sheetName: "Territories",
    workbookPath: join(options.rawDir, `Utility_Data_${eia861Source.year}.xlsx`),
  });
  const serviceTerritoryRows = readWorkbookRecords({
    firstDataRowIndex: 1,
    headerRowIndexes: [0],
    sheetName: "Counties_States",
    workbookPath: join(options.rawDir, `Service_Territory_${eia861Source.year}.xlsx`),
  });
  const balancingAuthorityRows = readWorkbookRecords({
    firstDataRowIndex: 1,
    headerRowIndexes: [0],
    sheetName: "Balancing Authority",
    workbookPath: join(options.rawDir, `Balancing_Authority_${eia861Source.year}.xlsx`),
  });
  const deliveryCompanyRows = readWorkbookRecords({
    firstDataRowIndex: 3,
    headerRowIndexes: [0, 1, 2],
    sheetName: "Delivery Companies",
    workbookPath: join(options.rawDir, `Delivery_Companies_${eia861Source.year}.xlsx`),
  });
  const salesRows = readWorkbookRecords({
    firstDataRowIndex: 3,
    headerRowIndexes: [0, 1, 2],
    sheetName: "States",
    workbookPath: join(options.rawDir, `Sales_Ult_Cust_${eia861Source.year}.xlsx`),
  });
  const territorySalesRows = readWorkbookRecords({
    firstDataRowIndex: 3,
    headerRowIndexes: [0, 1, 2],
    sheetName: "Territories",
    workbookPath: join(options.rawDir, `Sales_Ult_Cust_${eia861Source.year}.xlsx`),
  });
  const countyEntries = await loadCountyLookup();
  const countyFipsAliasRecords = buildCountyFipsAliasRecords();
  const countyFipsAliasLookup = buildCountyFipsAliasLookup(countyFipsAliasRecords);
  const countyLookupMaps = buildCountyLookupMaps(countyEntries);
  const placeCountyLookup = appendUniqueCountyLookup(
    await buildPlaceCountyLookup({
      content: await readZipTextFile(placesGazetteerZipPath),
    }),
    buildCountySubdivisionLookup({
      content: await readZipTextFile(countySubdivisionGazetteerZipPath),
    })
  );
  const deliveryCompanyUtilityKeys = buildDeliveryCompanyUtilityKeys(deliveryCompanyRows);
  const utilityProfiles = buildUtilityProfiles(
    [...utilityRows, ...territoryUtilityRows],
    deliveryCompanyUtilityKeys
  );
  const salesAggregates = buildSalesAggregates(
    [...salesRows, ...territorySalesRows],
    deliveryCompanyUtilityKeys
  );
  const countyServiceTerritoryEntries = [
    ...buildCountyServiceTerritoryEntries({
      countyLookup: countyLookupMaps,
      serviceTerritoryRows,
    }),
    ...buildTerritoryWideCountyServiceTerritoryEntries({
      countyEntries,
      territoryUtilityRows,
    }),
  ];
  const balancingAuthorityNameMap = buildBalancingAuthorityNameMap(balancingAuthorityRows);
  const stateBaChoiceShares = buildStateBaChoiceShareMap(salesAggregates);
  const utilityContextRecords = buildCountyUtilityContextRecords({
    countyEntries,
    countyServiceTerritoryEntries,
    salesAggregates,
    stateBaChoiceShares,
    utilityProfiles,
  });
  const sppQueueCsvContent = await fetchText(SPP_QUEUE_CSV_URL);
  writeTextAtomic(join(options.rawDir, "spp-active-queue.csv"), sppQueueCsvContent);
  const sppQueueResult = await buildSppQueueRecords({
    countyLookup: countyLookupMaps,
    csvContent: sppQueueCsvContent,
    effectiveDate,
    placeCountyLookup,
  });
  const pjmQueueResult = await buildPjmQueueRecords({
    countyLookup: countyLookupMaps,
    effectiveDate,
    placeCountyLookup,
    rawDir: options.rawDir,
  });
  const misoQueueResult = await buildMisoQueueRecords({
    countyLookup: countyLookupMaps,
    effectiveDate,
    placeCountyLookup,
    rawDir: options.rawDir,
  });
  const ercotQueueResult = await buildErcotQueueRecords({
    countyLookup: countyLookupMaps,
    effectiveDate,
    rawDir: options.rawDir,
  });
  const caisoQueueResult = await buildCaisoQueueRecords({
    countyLookup: countyLookupMaps,
    effectiveDate,
    placeCountyLookup,
    rawDir: options.rawDir,
  });
  const nyisoQueueResult = await buildNyisoQueueRecords({
    countyLookup: countyLookupMaps,
    effectiveDate,
    placeCountyLookup,
    rawDir: options.rawDir,
  });
  const isoNeQueueResult = await buildIsoNeQueueRecords({
    countyLookup: countyLookupMaps,
    effectiveDate,
    placeCountyLookup,
  });
  const sppCongestionResult = await buildSppCountyCongestionRecords();
  const operatorWeatherZoneResult = await buildErcotWeatherZoneByCountyFips({
    countyEntries,
    effectiveDate,
    rawDir: options.rawDir,
  });
  const meteoZoneResult = await buildNwsMeteoZoneByCountyFips({
    countyFipsAliasLookup,
    effectiveDate,
    rawDir: options.rawDir,
  });
  const operatorLoadZoneByCountyFips = buildOperatorLoadZoneMap({
    baseMaps: {
      CAISO: caisoQueueResult.countyLoadZones,
      "ISO-NE": isoNeQueueResult.countyLoadZones,
      MISO: buildMisoLocalResourceZoneByCountyFips(countyEntries),
      NYISO: nyisoQueueResult.countyLoadZones,
      SPP: sppCongestionResult.countySettlementLocations,
    },
  });
  const initialQueueProjects = [
    ...sppQueueResult.projects,
    ...pjmQueueResult.projects,
    ...misoQueueResult.projects,
    ...ercotQueueResult.projects,
    ...caisoQueueResult.projects,
    ...nyisoQueueResult.projects,
    ...isoNeQueueResult.projects,
  ];
  const initialQueueSnapshots = [
    ...sppQueueResult.snapshots,
    ...pjmQueueResult.snapshots,
    ...misoQueueResult.snapshots,
    ...ercotQueueResult.snapshots,
    ...caisoQueueResult.snapshots,
    ...nyisoQueueResult.snapshots,
    ...isoNeQueueResult.snapshots,
  ];
  const initialQueueCountyResolutions = dedupeJsonRows([
    ...sppQueueResult.countyResolutions,
    ...pjmQueueResult.countyResolutions,
    ...misoQueueResult.countyResolutions,
    ...ercotQueueResult.countyResolutions,
    ...caisoQueueResult.countyResolutions,
    ...nyisoQueueResult.countyResolutions,
    ...isoNeQueueResult.countyResolutions,
  ]);
  const initialQueueUnresolved = dedupeJsonRows([
    ...sppQueueResult.unresolved,
    ...pjmQueueResult.unresolved,
    ...misoQueueResult.unresolved,
    ...ercotQueueResult.unresolved,
    ...caisoQueueResult.unresolved,
    ...nyisoQueueResult.unresolved,
    ...isoNeQueueResult.unresolved,
  ]);
  const queueBackfillResult = applyQueuePoiReferenceBackfill({
    queueCountyResolutions: initialQueueCountyResolutions,
    queueProjects: initialQueueProjects,
    queueSnapshots: initialQueueSnapshots,
  });
  const queueProjects = queueBackfillResult.queueProjects;
  const queueSnapshots = queueBackfillResult.queueSnapshots;
  const queueCountyResolutions = queueBackfillResult.queueCountyResolutions;
  const queueProjectCountyByKey = new Map(
    queueProjects.map((project) => [
      `${project.sourceSystem}:${project.projectId}`,
      project.countyFips,
    ])
  );
  const resolvedProjectKeys = new Set(
    queueCountyResolutions.map((record) => `${record.sourceSystem}:${record.projectId}`)
  );
  const queueUnresolved = dedupeJsonRows(
    initialQueueUnresolved.filter((record) => {
      const projectKey = `${record.sourceSystem}:${record.projectId}`;
      if (resolvedProjectKeys.has(projectKey)) {
        return false;
      }
      return (queueProjectCountyByKey.get(projectKey) ?? null) === null;
    })
  );
  const queueSourceAsOfDate =
    pickLatestDate([
      sppQueueResult.sourceAsOfDate,
      pjmQueueResult.sourceAsOfDate,
      misoQueueResult.sourceAsOfDate,
      ercotQueueResult.sourceAsOfDate,
      caisoQueueResult.sourceAsOfDate,
      nyisoQueueResult.sourceAsOfDate,
      isoNeQueueResult.sourceAsOfDate,
    ]) ?? effectiveDate;
  const powerMarketRecords = buildCountyPowerMarketRecords({
    balancingAuthorityNameMap,
    countyEntries,
    countyServiceTerritoryEntries,
    meteoZoneByCountyFips: meteoZoneResult.map,
    operatorLoadZoneByCountyFips,
    operatorWeatherZoneByCountyFips: operatorWeatherZoneResult.map,
    salesAggregates,
    utilityProfiles,
  });
  const operatorRegions = buildOperatorRegionRecords(powerMarketRecords);
  const countyOperatorRegions = buildCountyOperatorRegionBridgeRecords(powerMarketRecords);
  const countyOperatorZones = buildCountyOperatorZoneBridgeRecords(powerMarketRecords);
  const operatorZoneReferences = buildOperatorZoneReferenceRecords({
    countyEntries,
    countyOperatorZones,
  });
  const operatorCountyMap = buildOperatorCountyMap(powerMarketRecords);
  const pjmCongestionResult = await buildPjmOperatorCongestionSummary();
  const misoCongestionResult = await buildMisoOperatorCongestionSummary();
  const ercotCongestionResult = await buildErcotOperatorCongestionSummary({
    effectiveDate,
    rawDir: options.rawDir,
  });
  const caisoCongestionResult = await buildCaisoOperatorCongestionSummary({
    effectiveDate,
    rawDir: options.rawDir,
  });
  const nyisoCongestionResult = await buildNyisoOperatorCongestionSummary();
  const isoNeCongestionResult = await buildIsoNeOperatorCongestionSummary({
    effectiveDate,
  });
  const congestionRecords = buildMergedCountyCongestionRecords({
    caisoAggregate: caisoCongestionResult.aggregate,
    ercotAggregate: ercotCongestionResult.aggregate,
    isoNeAggregate: isoNeCongestionResult.aggregate,
    isoNeZonalAggregates: isoNeCongestionResult.zonalAggregates ?? new Map(),
    misoAggregate: misoCongestionResult.aggregate,
    misoZonalAggregates: misoCongestionResult.zonalAggregates ?? new Map(),
    nyisoAggregate: nyisoCongestionResult.aggregate,
    nyisoZonalAggregates: nyisoCongestionResult.zonalAggregates ?? new Map(),
    operatorCountyMap,
    powerMarketRecords,
    pjmAggregate: pjmCongestionResult.aggregate,
    pjmZonalAggregates: pjmCongestionResult.zonalAggregates ?? new Map(),
    sppAggregate: buildAggregateCongestionFromCountyRecords(sppCongestionResult.records),
    sppCountyRecords: sppCongestionResult.records,
    sppZonalAggregates: sppCongestionResult.zonalAggregates ?? new Map(),
  });
  const gridFrictionRecords = buildCountyGridFrictionRecords({
    congestionRecords,
    queueSnapshots,
  });
  const queuePoiReferences = buildQueuePoiReferenceRecords({
    powerMarketRecords,
    queueProjects,
  });
  const queueResolutionOverrides = buildQueueResolutionOverrideRecords({
    countyLookup: countyLookupMaps,
  });
  const transmissionResult = await buildCountyTransmissionRecords(countyEntries);
  const fiberResult = await buildCountyFiberRecords({
    countyEntries,
    effectiveDate,
    rawDir: options.rawDir,
  });
  const gasResult = await buildCountyGasRecords({
    countyEntries,
    countyFipsAliasLookup,
    effectiveDate,
    rawDir: options.rawDir,
  });
  const communitySolarPolicyRecords = buildCommunitySolarPolicyRecords({
    countyEntries,
    effectiveDate,
    workbookPath: communitySolarPolicyWorkbookPath,
  });
  const gridFrictionSourceAsOfDate =
    queueSourceAsOfDate >=
    (pickLatestDate([
      caisoCongestionResult.sourceAsOfDate,
      ercotCongestionResult.sourceAsOfDate,
      isoNeCongestionResult.sourceAsOfDate,
      misoCongestionResult.sourceAsOfDate,
      nyisoCongestionResult.sourceAsOfDate,
      pjmCongestionResult.sourceAsOfDate,
      sppCongestionResult.sourceAsOfDate,
    ]) ?? effectiveDate)
      ? queueSourceAsOfDate
      : (pickLatestDate([
          caisoCongestionResult.sourceAsOfDate,
          ercotCongestionResult.sourceAsOfDate,
          isoNeCongestionResult.sourceAsOfDate,
          misoCongestionResult.sourceAsOfDate,
          nyisoCongestionResult.sourceAsOfDate,
          pjmCongestionResult.sourceAsOfDate,
          sppCongestionResult.sourceAsOfDate,
        ]) ?? effectiveDate);
  const congestionSourceAsOfDate =
    pickLatestDate([
      caisoCongestionResult.sourceAsOfDate,
      ercotCongestionResult.sourceAsOfDate,
      isoNeCongestionResult.sourceAsOfDate,
      misoCongestionResult.sourceAsOfDate,
      nyisoCongestionResult.sourceAsOfDate,
      pjmCongestionResult.sourceAsOfDate,
      sppCongestionResult.sourceAsOfDate,
    ]) ?? effectiveDate;
  writeNdjson(join(options.rawDir, "county-fips-aliases.ndjson"), countyFipsAliasRecords);
  writeNdjson(join(options.rawDir, "operator-regions.ndjson"), operatorRegions);
  writeNdjson(join(options.rawDir, "county-operator-regions.ndjson"), countyOperatorRegions);
  writeNdjson(
    join(options.rawDir, "operator-zone-references.ndjson"),
    operatorZoneReferences.map((record) => ({
      confidenceClass: record.confidenceClass,
      operator: record.operator,
      owner: record.owner,
      operatorZoneConfidence: record.operatorZoneConfidence,
      operatorZoneLabel: record.operatorZoneLabel,
      operatorZoneType: record.operatorZoneType,
      referenceName: record.referenceName,
      resolutionMethod: record.resolutionMethod,
      sourceArtifact: record.sourceArtifact,
      sourceVersion: record.sourceVersion,
      stateAbbrev: record.stateAbbrev,
    }))
  );
  writeNdjson(
    join(options.rawDir, "county-operator-zones.ndjson"),
    countyOperatorZones.map((record) => ({
      allocationShare: record.allocationShare,
      confidenceClass: record.confidenceClass,
      countyFips: record.countyFips,
      isPrimarySubregion: record.isPrimarySubregion,
      operator: record.operator,
      owner: record.owner,
      operatorZoneConfidence: record.operatorZoneConfidence,
      operatorZoneLabel: record.operatorZoneLabel,
      operatorZoneType: record.operatorZoneType,
      resolutionMethod: record.resolutionMethod,
      sourceArtifact: record.sourceArtifact,
      sourceVersion: record.sourceVersion,
    }))
  );
  writeNdjson(
    join(options.rawDir, "power-market-context.ndjson"),
    powerMarketRecords.map((record) => ({
      balancingAuthority: record.balancingAuthority,
      countyFips: record.countyFips,
      loadZone: record.loadZone,
      marketStructure: record.marketStructure,
      meteoZone: record.meteoZone,
      operatorWeatherZone: record.operatorWeatherZone,
      operatorZoneConfidence: record.operatorZoneConfidence,
      operatorZoneLabel: record.operatorZoneLabel,
      operatorZoneType: record.operatorZoneType,
      weatherZone: record.weatherZone,
      wholesaleOperator: record.wholesaleOperator,
    }))
  );
  writeNdjson(
    join(options.rawDir, "queue-poi-references.ndjson"),
    queuePoiReferences.map((record) => ({
      countyFips: record.countyFips,
      operator: record.operator,
      operatorZoneLabel: record.operatorZoneLabel,
      operatorZoneType: record.operatorZoneType,
      queuePoiLabel: record.queuePoiLabel,
      resolutionMethod: record.resolutionMethod,
      resolverConfidence: record.resolverConfidence,
      sourceSystem: record.sourceSystem,
      stateAbbrev: record.stateAbbrev,
    }))
  );
  writeNdjson(
    join(options.rawDir, "utility-context.ndjson"),
    utilityContextRecords.map((record) => ({
      competitiveAreaType: record.competitiveAreaType,
      countyFips: record.countyFips,
      dominantUtilityId: record.dominantUtilityId,
      dominantUtilityName: record.dominantUtilityName,
      primaryTduOrUtility: record.primaryTduOrUtility,
      retailChoicePenetrationShare: record.retailChoicePenetrationShare,
      retailChoiceStatus: record.retailChoiceStatus,
      territoryType: record.territoryType,
      utilities: record.utilities,
      utilityCount: record.utilityCount,
    }))
  );
  writeNdjson(
    join(options.rawDir, "gas.ndjson"),
    gasResult.records.map((record) => ({
      countyFips: record.countyFips,
      gasPipelineMileageCounty: record.gasPipelineMileageCounty,
      gasPipelinePresenceFlag: record.gasPipelinePresenceFlag,
    }))
  );
  writeNdjson(
    join(options.rawDir, "fiber.ndjson"),
    fiberResult.records.map((record) => ({
      countyFips: record.countyFips,
      fiberPresenceFlag: record.fiberPresenceFlag,
    }))
  );
  writeNdjson(
    join(options.rawDir, "transmission.ndjson"),
    transmissionResult.records.map((record) => ({
      countyFips: record.countyFips,
      miles138kvPlus: record.miles138kvPlus,
      miles230kvPlus: record.miles230kvPlus,
      miles345kvPlus: record.miles345kvPlus,
      miles500kvPlus: record.miles500kvPlus,
      miles69kvPlus: record.miles69kvPlus,
      miles765kvPlus: record.miles765kvPlus,
    }))
  );
  writeNdjson(
    join(options.rawDir, "queue-projects.ndjson"),
    queueProjects.map((record) => ({
      countyFips: record.countyFips,
      fuelType: record.fuelType,
      latestSourceAsOfDate: record.latestSourceAsOfDate,
      marketId: record.marketId,
      nativeStatus: record.nativeStatus,
      projectId: record.projectId,
      queueCountyConfidence: record.queueCountyConfidence,
      queuePoiLabel: record.queuePoiLabel,
      queueName: record.queueName,
      queueResolverType: record.queueResolverType,
      stageGroup: record.stageGroup,
      sourceSystem: record.sourceSystem,
      stateAbbrev: record.stateAbbrev,
    }))
  );
  writeNdjson(
    join(options.rawDir, "queue-county-resolutions.ndjson"),
    queueCountyResolutions.map((record) => ({
      allocationShare: record.allocationShare,
      countyFips: record.countyFips,
      marketId: record.marketId,
      projectId: record.projectId,
      queuePoiLabel: record.queuePoiLabel,
      resolverConfidence: record.resolverConfidence,
      resolverType: record.resolverType,
      sourceLocationLabel: record.sourceLocationLabel,
      sourceSystem: record.sourceSystem,
      stateAbbrev: record.stateAbbrev,
    }))
  );
  writeNdjson(
    join(options.rawDir, "queue-snapshots.ndjson"),
    queueSnapshots.map((record) => ({
      capacityMw: record.capacityMw,
      completionPrior: record.completionPrior,
      countyFips: record.countyFips,
      daysInQueueActive: record.daysInQueueActive,
      expectedOperationDate: record.expectedOperationDate,
      isPastDue: record.isPastDue,
      marketId: record.marketId,
      nativeStatus: record.nativeStatus,
      projectId: record.projectId,
      queueDate: record.queueDate,
      queueStatus: record.queueStatus,
      signedIa: record.signedIa,
      sourceSystem: record.sourceSystem,
      stageGroup: record.stageGroup,
      stateAbbrev: record.stateAbbrev,
      transmissionUpgradeCostUsd: record.transmissionUpgradeCostUsd,
      transmissionUpgradeCount: record.transmissionUpgradeCount,
      withdrawalPrior: record.withdrawalPrior,
    }))
  );
  writeNdjson(
    join(options.rawDir, "queue-unresolved.ndjson"),
    queueUnresolved.map((record) => ({
      candidateCountyFips: record.candidateCountyFips,
      manualReviewFlag: record.manualReviewFlag,
      marketId: record.marketId,
      nativeStatus: record.nativeStatus,
      projectId: record.projectId,
      queueName: record.queueName,
      queuePoiLabel: record.queuePoiLabel,
      rawLocationLabel: record.rawLocationLabel,
      sourceSystem: record.sourceSystem,
      stateAbbrev: record.stateAbbrev,
      unresolvedReason: record.unresolvedReason,
    }))
  );
  writeNdjson(
    join(options.rawDir, "queue-resolution-overrides.ndjson"),
    queueResolutionOverrides.map((record) => ({
      allocationShare: record.allocationShare,
      countyFips: record.countyFips,
      matcherType: record.matcherType,
      matcherValue: record.matcherValue,
      notes: record.notes,
      resolverConfidence: record.resolverConfidence,
      resolverType: record.resolverType,
      sourceSystem: record.sourceSystem,
      stateAbbrev: record.stateAbbrev,
    }))
  );
  writeNdjson(
    join(options.rawDir, "grid-friction.ndjson"),
    gridFrictionRecords.map((record) => ({
      confidence: record.confidence,
      congestionProxyScore: record.congestionProxyScore,
      countyFips: record.countyFips,
      heatmapSignalAvailable: record.heatmapSignalAvailable,
      marketWithdrawalPrior: record.marketWithdrawalPrior,
      medianDaysInQueueActive: record.medianDaysInQueueActive,
      pastDueShare: record.pastDueShare,
      plannedTransmissionUpgradeCount: record.plannedTransmissionUpgradeCount,
      statusMix: record.statusMix,
    }))
  );
  writeNdjson(
    join(options.rawDir, "congestion.ndjson"),
    congestionRecords.map((record) => ({
      avgRtCongestionComponent: record.avgRtCongestionComponent,
      countyFips: record.countyFips,
      negativePriceHourShare: record.negativePriceHourShare,
      p95ShadowPrice: record.p95ShadowPrice,
      topConstraints: record.topConstraints,
    }))
  );
  writeNdjson(
    join(options.rawDir, "policy-events.ndjson"),
    communitySolarPolicyRecords.policyEvents.map((record) => ({
      affectedSitingDimension: record.affectedSitingDimension,
      countyFips: record.countyFips,
      confidenceClass: record.confidenceClass,
      eventDate: record.eventDate,
      eventId: record.eventId,
      eventType: record.eventType,
      evidenceSummary: record.evidenceSummary,
      jurisdictionKey: record.jurisdictionKey,
      jurisdictionLevel: record.jurisdictionLevel,
      marketId: record.marketId,
      moratoriumStatus: record.moratoriumStatus,
      policyDirection: record.policyDirection,
      policyStatus: record.policyStatus,
      policyType: record.policyType,
      sentimentDirection: record.sentimentDirection,
      sourceUrl: record.sourceUrl,
      stateAbbrev: record.stateAbbrev,
      title: record.title,
    }))
  );
  writeNdjson(
    join(options.rawDir, "policy-snapshots.ndjson"),
    communitySolarPolicyRecords.policySnapshots.map((record) => ({
      countyFips: record.countyFips,
      countyTaggedEventShare: record.countyTaggedEventShare,
      moratoriumStatus: record.moratoriumStatus,
      policyConstraintScore: record.policyConstraintScore,
      policyEventCount: record.policyEventCount,
      policyMappingConfidence: record.policyMappingConfidence,
      policyMomentumScore: record.policyMomentumScore,
      publicSentimentScore: record.publicSentimentScore,
    }))
  );
  const manifest = {
    bundleVersion: "county-power-v1",
    dataVersion,
    datasets: {
      countyFipsAliases: {
        path: "county-fips-aliases.ndjson",
        recordCount: countyFipsAliasRecords.length,
        sourceAsOfDate: "2025-12-31",
        sourceName: "census-county-fips-aliases",
        sourceUri: [CENSUS_GEOGRAPHY_CHANGES_SOURCE_PAGE_URL, CENSUS_GAZETTEER_PAGE_URL].join(
          " | "
        ),
        sourceVersion: "2025-12-31",
      },
      countyOperatorRegions: {
        path: "county-operator-regions.ndjson",
        recordCount: countyOperatorRegions.length,
        sourceAsOfDate:
          pickLatestDate([
            `${eia861Source.year}-12-31`,
            meteoZoneResult.sourceAsOfDate,
            nyisoQueueResult.sourceAsOfDate,
            operatorWeatherZoneResult.sourceAsOfDate,
            isoNeQueueResult.sourceAsOfDate,
          ]) ?? `${eia861Source.year}-12-31`,
        sourceName: "public-us-county-operator-region-bridges",
        sourceUri: [
          ERCOT_APPENDIX_D_PROFILE_DECISION_TREE_URL,
          meteoZoneResult.sourceUri,
          UTILITY_DATA_SOURCE_PAGE_URL,
          MISO_LRZ_SOURCE_URL,
          NYISO_QUEUE_SOURCE_PAGE_URL,
          PJM_QUEUE_SOURCE_PAGE_URL,
          SPP_SETTLEMENT_LOCATION_SOURCE_PAGE_URL,
          ISO_NE_QUEUE_SOURCE_PAGE_URL,
        ].join(" | "),
        sourceVersion:
          pickLatestDate([
            `${eia861Source.year}-12-31`,
            meteoZoneResult.sourceAsOfDate,
            nyisoQueueResult.sourceAsOfDate,
            operatorWeatherZoneResult.sourceAsOfDate,
            isoNeQueueResult.sourceAsOfDate,
          ]) ?? `${eia861Source.year}-12-31`,
      },
      countyOperatorZones: {
        path: "county-operator-zones.ndjson",
        recordCount: countyOperatorZones.length,
        sourceAsOfDate:
          pickLatestDate([
            `${eia861Source.year}-12-31`,
            meteoZoneResult.sourceAsOfDate,
            nyisoQueueResult.sourceAsOfDate,
            operatorWeatherZoneResult.sourceAsOfDate,
            isoNeQueueResult.sourceAsOfDate,
            congestionSourceAsOfDate,
          ]) ?? `${eia861Source.year}-12-31`,
        sourceName: "public-us-county-operator-zone-bridges",
        sourceUri: [
          ERCOT_APPENDIX_D_PROFILE_DECISION_TREE_URL,
          ISO_NE_QUEUE_SOURCE_PAGE_URL,
          NWS_ZONE_COUNTY_PAGE_URL,
          MISO_LRZ_SOURCE_URL,
          NYISO_QUEUE_SOURCE_PAGE_URL,
          PJM_QUEUE_SOURCE_PAGE_URL,
          SPP_SETTLEMENT_LOCATION_SOURCE_PAGE_URL,
        ].join(" | "),
        sourceVersion:
          pickLatestDate([
            `${eia861Source.year}-12-31`,
            meteoZoneResult.sourceAsOfDate,
            nyisoQueueResult.sourceAsOfDate,
            operatorWeatherZoneResult.sourceAsOfDate,
            isoNeQueueResult.sourceAsOfDate,
            congestionSourceAsOfDate,
          ]) ?? `${eia861Source.year}-12-31`,
      },
      fiber: {
        path: "fiber.ndjson",
        recordCount: fiberResult.records.length,
        sourceAsOfDate: fiberResult.sourceAsOfDate,
        sourceName: "fiberlocator-county-fiber-presence",
        sourceUri: fiberResult.sourceUri,
        sourceVersion: fiberResult.sourceVersion,
      },
      gas: {
        path: "gas.ndjson",
        recordCount: gasResult.records.length,
        sourceAsOfDate: gasResult.sourceAsOfDate,
        sourceName: "npms-active-gas-transmission-county-mileage",
        sourceUri: [NPMS_PUBLIC_PORTAL_URL, NPMS_ACTIVE_PIPE_COUNTY_MILEAGE_URL].join(" | "),
        sourceVersion: gasResult.sourceAsOfDate,
      },
      congestion: {
        path: "congestion.ndjson",
        recordCount: congestionRecords.length,
        sourceAsOfDate: congestionSourceAsOfDate,
        sourceName: "public-us-county-congestion",
        sourceUri: [
          CAISO_OASIS_SINGLE_ZIP_URL,
          ERCOT_CONGESTION_SOURCE_PAGE_URL,
          ISO_NE_REAL_TIME_CONSTRAINT_SOURCE_PAGE_URL,
          ISO_NE_REAL_TIME_LMP_SOURCE_PAGE_URL,
          MISO_CONGESTION_SOURCE_PAGE_URL,
          NYISO_CONGESTION_SOURCE_PAGE_URL,
          PJM_CONGESTION_SOURCE_PAGE_URL,
          SPP_RTBM_SOURCE_PAGE_URL,
        ].join(" | "),
        sourceVersion: congestionSourceAsOfDate,
      },
      gridFriction: {
        path: "grid-friction.ndjson",
        recordCount: gridFrictionRecords.length,
        sourceAsOfDate: gridFrictionSourceAsOfDate,
        sourceName: "public-us-grid-friction-derived",
        sourceUri: [
          CAISO_PUBLIC_QUEUE_REPORT_PAGE_URL,
          CAISO_OASIS_SINGLE_ZIP_URL,
          ERCOT_QUEUE_SOURCE_PAGE_URL,
          ERCOT_CONGESTION_SOURCE_PAGE_URL,
          ISO_NE_QUEUE_SOURCE_PAGE_URL,
          ISO_NE_REAL_TIME_CONSTRAINT_SOURCE_PAGE_URL,
          ISO_NE_REAL_TIME_LMP_SOURCE_PAGE_URL,
          MISO_QUEUE_SOURCE_PAGE_URL,
          MISO_CONGESTION_SOURCE_PAGE_URL,
          NYISO_QUEUE_SOURCE_PAGE_URL,
          NYISO_CONGESTION_SOURCE_PAGE_URL,
          PJM_QUEUE_SOURCE_PAGE_URL,
          PJM_CONGESTION_SOURCE_PAGE_URL,
          SPP_QUEUE_SOURCE_PAGE_URL,
          SPP_RTBM_SOURCE_PAGE_URL,
        ].join(" | "),
        sourceVersion: gridFrictionSourceAsOfDate,
      },
      operatorRegions: {
        path: "operator-regions.ndjson",
        recordCount: operatorRegions.length,
        sourceAsOfDate:
          pickLatestDate([
            `${eia861Source.year}-12-31`,
            meteoZoneResult.sourceAsOfDate,
            nyisoQueueResult.sourceAsOfDate,
            operatorWeatherZoneResult.sourceAsOfDate,
            isoNeQueueResult.sourceAsOfDate,
          ]) ?? `${eia861Source.year}-12-31`,
        sourceName: "public-us-operator-regions",
        sourceUri: [
          ERCOT_APPENDIX_D_PROFILE_DECISION_TREE_URL,
          meteoZoneResult.sourceUri,
          UTILITY_DATA_SOURCE_PAGE_URL,
          MISO_LRZ_SOURCE_URL,
          NYISO_QUEUE_SOURCE_PAGE_URL,
          PJM_QUEUE_SOURCE_PAGE_URL,
          SPP_SETTLEMENT_LOCATION_SOURCE_PAGE_URL,
          ISO_NE_QUEUE_SOURCE_PAGE_URL,
        ].join(" | "),
        sourceVersion:
          pickLatestDate([
            `${eia861Source.year}-12-31`,
            meteoZoneResult.sourceAsOfDate,
            nyisoQueueResult.sourceAsOfDate,
            operatorWeatherZoneResult.sourceAsOfDate,
            isoNeQueueResult.sourceAsOfDate,
          ]) ?? `${eia861Source.year}-12-31`,
      },
      policyEvents: {
        path: "policy-events.ndjson",
        recordCount: communitySolarPolicyRecords.policyEvents.length,
        sourceAsOfDate: communitySolarPolicySource.sourceAsOfDate,
        sourceName: "nlr-state-community-solar-policy-events",
        sourceUri: COMMUNITY_SOLAR_POLICY_SUBMISSION_URL,
        sourceVersion: communitySolarPolicySource.sourceAsOfDate,
      },
      policySnapshots: {
        path: "policy-snapshots.ndjson",
        recordCount: communitySolarPolicyRecords.policySnapshots.length,
        sourceAsOfDate: communitySolarPolicySource.sourceAsOfDate,
        sourceName: "nlr-state-community-solar-policy-snapshots",
        sourceUri: COMMUNITY_SOLAR_POLICY_SUBMISSION_URL,
        sourceVersion: communitySolarPolicySource.sourceAsOfDate,
      },
      powerMarketContext: {
        path: "power-market-context.ndjson",
        recordCount: powerMarketRecords.length,
        sourceAsOfDate:
          pickLatestDate([
            `${eia861Source.year}-12-31`,
            meteoZoneResult.sourceAsOfDate,
            nyisoQueueResult.sourceAsOfDate,
            operatorWeatherZoneResult.sourceAsOfDate,
            isoNeQueueResult.sourceAsOfDate,
          ]) ?? `${eia861Source.year}-12-31`,
        sourceName: "public-us-county-power-market-context",
        sourceUri: [
          ERCOT_APPENDIX_D_PROFILE_DECISION_TREE_URL,
          meteoZoneResult.sourceUri,
          UTILITY_DATA_SOURCE_PAGE_URL,
          MISO_LRZ_SOURCE_URL,
          NYISO_QUEUE_SOURCE_PAGE_URL,
          PJM_QUEUE_SOURCE_PAGE_URL,
          SPP_SETTLEMENT_LOCATION_SOURCE_PAGE_URL,
          ISO_NE_QUEUE_SOURCE_PAGE_URL,
        ].join(" | "),
        sourceVersion:
          pickLatestDate([
            `${eia861Source.year}-12-31`,
            meteoZoneResult.sourceAsOfDate,
            nyisoQueueResult.sourceAsOfDate,
            operatorWeatherZoneResult.sourceAsOfDate,
            isoNeQueueResult.sourceAsOfDate,
          ]) ?? `${eia861Source.year}-12-31`,
      },
      operatorZoneReferences: {
        path: "operator-zone-references.ndjson",
        recordCount: operatorZoneReferences.length,
        sourceAsOfDate:
          pickLatestDate([
            isoNeQueueResult.sourceAsOfDate,
            nyisoQueueResult.sourceAsOfDate,
            queueSourceAsOfDate,
            congestionSourceAsOfDate,
          ]) ?? queueSourceAsOfDate,
        sourceName: "public-us-operator-zone-references",
        sourceUri: [
          ISO_NE_QUEUE_SOURCE_PAGE_URL,
          MISO_LRZ_SOURCE_URL,
          NYISO_QUEUE_SOURCE_PAGE_URL,
          PJM_SYSTEM_MAP_SOURCE_URL,
          SPP_SETTLEMENT_LOCATION_SOURCE_PAGE_URL,
        ].join(" | "),
        sourceVersion:
          pickLatestDate([
            isoNeQueueResult.sourceAsOfDate,
            nyisoQueueResult.sourceAsOfDate,
            queueSourceAsOfDate,
            congestionSourceAsOfDate,
          ]) ?? queueSourceAsOfDate,
      },
      queueCountyResolutions: {
        path: "queue-county-resolutions.ndjson",
        recordCount: queueCountyResolutions.length,
        sourceAsOfDate: queueSourceAsOfDate,
        sourceName: "public-us-interconnection-queue-county-resolutions",
        sourceUri: [
          CENSUS_GAZETTEER_PAGE_URL,
          CAISO_PUBLIC_QUEUE_REPORT_PAGE_URL,
          NYISO_QUEUE_SOURCE_PAGE_URL,
          ISO_NE_QUEUE_SOURCE_PAGE_URL,
          SPP_QUEUE_SOURCE_PAGE_URL,
          PJM_QUEUE_SOURCE_PAGE_URL,
          MISO_QUEUE_SOURCE_PAGE_URL,
          ERCOT_QUEUE_SOURCE_PAGE_URL,
        ].join(" | "),
        sourceVersion: queueSourceAsOfDate,
      },
      queuePoiReferences: {
        path: "queue-poi-references.ndjson",
        recordCount: queuePoiReferences.length,
        sourceAsOfDate: queueSourceAsOfDate,
        sourceName: "public-us-queue-poi-references",
        sourceUri: [
          CAISO_PUBLIC_QUEUE_REPORT_PAGE_URL,
          ERCOT_QUEUE_SOURCE_PAGE_URL,
          ISO_NE_QUEUE_SOURCE_PAGE_URL,
          MISO_QUEUE_SOURCE_PAGE_URL,
          NYISO_QUEUE_SOURCE_PAGE_URL,
          PJM_SYSTEM_MAP_SOURCE_URL,
          PJM_QUEUE_SOURCE_PAGE_URL,
          SPP_QUEUE_SOURCE_PAGE_URL,
          SPP_SETTLEMENT_LOCATION_SOURCE_PAGE_URL,
        ].join(" | "),
        sourceVersion: queueSourceAsOfDate,
      },
      queueProjects: {
        path: "queue-projects.ndjson",
        recordCount: queueProjects.length,
        sourceAsOfDate: queueSourceAsOfDate,
        sourceName: "public-us-interconnection-queue-projects",
        sourceUri: [
          CENSUS_GAZETTEER_PAGE_URL,
          CAISO_PUBLIC_QUEUE_REPORT_PAGE_URL,
          NYISO_QUEUE_SOURCE_PAGE_URL,
          ISO_NE_QUEUE_SOURCE_PAGE_URL,
          SPP_QUEUE_SOURCE_PAGE_URL,
          PJM_QUEUE_SOURCE_PAGE_URL,
          MISO_QUEUE_SOURCE_PAGE_URL,
          ERCOT_QUEUE_SOURCE_PAGE_URL,
        ].join(" | "),
        sourceVersion: queueSourceAsOfDate,
      },
      queueResolutionOverrides: {
        path: "queue-resolution-overrides.ndjson",
        recordCount: queueResolutionOverrides.length,
        sourceAsOfDate: queueSourceAsOfDate,
        sourceName: "public-us-queue-resolution-overrides",
        sourceUri: [
          CENSUS_GAZETTEER_PAGE_URL,
          PJM_SYSTEM_MAP_SOURCE_URL,
          SPP_SETTLEMENT_LOCATION_SOURCE_PAGE_URL,
        ].join(" | "),
        sourceVersion: queueSourceAsOfDate,
      },
      queueSnapshots: {
        path: "queue-snapshots.ndjson",
        recordCount: queueSnapshots.length,
        sourceAsOfDate: queueSourceAsOfDate,
        sourceName: "public-us-interconnection-queue-snapshots",
        sourceUri: [
          CENSUS_GAZETTEER_PAGE_URL,
          CAISO_PUBLIC_QUEUE_REPORT_PAGE_URL,
          NYISO_QUEUE_SOURCE_PAGE_URL,
          ISO_NE_QUEUE_SOURCE_PAGE_URL,
          SPP_QUEUE_SOURCE_PAGE_URL,
          PJM_QUEUE_SOURCE_PAGE_URL,
          MISO_QUEUE_SOURCE_PAGE_URL,
          ERCOT_QUEUE_SOURCE_PAGE_URL,
        ].join(" | "),
        sourceVersion: queueSourceAsOfDate,
      },
      queueUnresolved: {
        path: "queue-unresolved.ndjson",
        recordCount: queueUnresolved.length,
        sourceAsOfDate: queueSourceAsOfDate,
        sourceName: "public-us-interconnection-queue-unresolved",
        sourceUri: [
          CENSUS_GAZETTEER_PAGE_URL,
          CAISO_PUBLIC_QUEUE_REPORT_PAGE_URL,
          NYISO_QUEUE_SOURCE_PAGE_URL,
          ISO_NE_QUEUE_SOURCE_PAGE_URL,
          SPP_QUEUE_SOURCE_PAGE_URL,
          PJM_QUEUE_SOURCE_PAGE_URL,
          MISO_QUEUE_SOURCE_PAGE_URL,
          ERCOT_QUEUE_SOURCE_PAGE_URL,
          PJM_SYSTEM_MAP_SOURCE_URL,
          SPP_SETTLEMENT_LOCATION_SOURCE_PAGE_URL,
        ].join(" | "),
        sourceVersion: queueSourceAsOfDate,
      },
      transmission: {
        path: "transmission.ndjson",
        recordCount: transmissionResult.records.length,
        sourceAsOfDate: transmissionResult.sourceAsOfDate,
        sourceName: "federal-us-transmission-lines-archive",
        sourceUri: TRANSMISSION_SOURCE_PAGE_URL,
        sourceVersion: transmissionResult.sourceAsOfDate,
      },
      utilityContext: {
        path: "utility-context.ndjson",
        recordCount: utilityContextRecords.length,
        sourceAsOfDate: `${eia861Source.year}-12-31`,
        sourceName: `eia-861-${eia861Source.year}-county-retail-context`,
        sourceUri: SERVICE_TERRITORY_SOURCE_PAGE_URL,
        sourceVersion: eia861Source.year,
      },
    },
    effectiveDate,
    generatedAt,
    month,
  };
  writeJsonAtomic(options.rawManifestPath, manifest);
  return {
    dataVersion,
    effectiveDate,
    manifest,
    manifestPath: null,
    manifestUrl: null,
    month,
  };
}
