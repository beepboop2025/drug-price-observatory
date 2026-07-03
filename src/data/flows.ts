// =============================================================================
// PRECURSOR CHEMICAL FLOWS, PRICES & SEIZURES  (the "upstream" awareness layer)
// =============================================================================
//
// DATA PROVENANCE:
//   • FLOW_RECORDS — OFFICIAL. Corridor statements extracted verbatim from the
//     INCB Precursors Report 2025 (published Feb 2026; paragraph numbers cited
//     per record):
//     https://www.incb.org/incb/en/precursors/technical_reports/precursors-technical-reports.html
//     Each record is a seizure/incident corridor the Board itself reports at
//     country grain. Quantities are as stated (one is gross preparation
//     weight, noted inline).
//   • PRECURSOR_PRICE_RECORDS — ILLUSTRATIVE. INCB does not publish precursor
//     prices; pending a citable source, these remain labelled samples.
//
// ETHICAL GRAIN (hard rule): LOGISTICS ONLY — what chemical class, end-drug,
// INCB scheduling, how much seized, and the country-to-country corridor. NO
// chemistry fields: no synthesis routes, no conversion ratios, no yields.
// (The INCB report's manufacturing-method annex was deliberately NOT ingested.)
// =============================================================================

import type {
  PrecursorMeta, FlowRecord, PrecursorPriceRecord, Centroid,
} from '../types'

export const PRECURSORS: PrecursorMeta[] = [
  { id: 'fentanyl_precursors', label: 'Fentanyl-class precursors', endDrug: 'Fentanyl & analogues', incbScheduled: true },
  { id: 'meth_precursors', label: 'Methamphetamine precursors (incl. ephedrines)', endDrug: 'Methamphetamine', incbScheduled: true },
  { id: 'meth_pre_precursors', label: 'Meth "designer" pre-precursors', endDrug: 'Methamphetamine', incbScheduled: false },
  { id: 'heroin_precursors', label: 'Heroin precursors (acetylating agents)', endDrug: 'Heroin', incbScheduled: true },
  { id: 'mdma_precursors', label: 'MDMA ("ecstasy") precursors', endDrug: 'MDMA', incbScheduled: true },
  { id: 'cocaine_precursors', label: 'Cocaine precursors (oxidizers)', endDrug: 'Cocaine', incbScheduled: true },
]

// Aggregate corridor records — every row is a corridor the INCB Precursors
// Report 2025 states explicitly (paragraph cited). quantityKg = seized or
// interdicted amount reported for that corridor/incident.
const INCB25 = {
  sourceName: 'INCB Precursors Report 2025',
  sourceUrl: 'https://www.incb.org/incb/en/precursors/technical_reports/precursors-technical-reports.html',
}
export const FLOW_RECORDS: FlowRecord[] = [
  // ¶92: six PICS seizures of 3,4-MDP-2-P ethyl glycidate totalling <1,500 kg
  // in the first 10 months of 2025; two thirds seized in Thailand, "destined
  // for Myanmar" — a rare official designer-precursor corridor into the
  // Golden Triangle.
  { precursor: 'mdma_precursors', origin: 'Thailand', transit: null, destination: 'Myanmar', year: 2025, quantityKg: 1000, ...INCB25 },
  // ¶94: nine incidents, ~5 tons of 4-phenylacetoacetic acid esters (new meth
  // pre-precursors), mislabelled, "originated in China and were destined for
  // countries in the European Union".
  { precursor: 'meth_pre_precursors', origin: 'China', transit: null, destination: 'European Union', year: 2025, quantityKg: 5000, ...INCB25 },
  // ¶47: >15 tons GROSS WEIGHT of a pseudoephedrine preparation, originated
  // in Morocco, transiting Türkiye, destined for Iran; no pre-export
  // notification; far exceeded Iran's annual legitimate requirement.
  { precursor: 'meth_precursors', origin: 'Morocco', transit: 'Türkiye', destination: 'Iran', year: 2025, quantityKg: 15000, ...INCB25 },
  // ¶46 + ¶67 (Operation Pseudonym): ephedrines seized in Australia (~1 t in
  // 2024) and New Zealand (1.2 t), origins "reported as being China and
  // India" — encoded with the joint origin string the Board uses.
  { precursor: 'meth_precursors', origin: 'China / India', transit: null, destination: 'Australia', year: 2024, quantityKg: 1000, ...INCB25 },
  { precursor: 'meth_precursors', origin: 'China / India', transit: null, destination: 'New Zealand', year: 2024, quantityKg: 1200, ...INCB25 },
  // ¶112: Ecuador reported ~2 t of potassium permanganate seized in 2024,
  // all as a transit country "with consignments destined for Colombia".
  { precursor: 'cocaine_precursors', origin: 'Ecuador', transit: null, destination: 'Colombia', year: 2024, quantityKg: 2000, ...INCB25 },
  // ¶74: DR Congo's first form-D submission: 110 kg ephedrine + 240 kg
  // pseudoephedrine preparations, "originated in India".
  { precursor: 'meth_precursors', origin: 'India', transit: null, destination: 'Democratic Republic of the Congo', year: 2024, quantityKg: 350, ...INCB25 },
  // ¶76: Germany, six incidents, 40 kg of pseudoephedrine preparations
  // "originating in Egypt ... concealed in coffee bags".
  { precursor: 'meth_precursors', origin: 'Egypt', transit: null, destination: 'Germany', year: 2024, quantityKg: 40, ...INCB25 },
]

// Precursor PRICES — aggregate, country + year, USD per kilogram. A spiking
// precursor price is a leading indicator of enforcement pressure on the chain.
// ILLUSTRATIVE: INCB publishes no precursor price series; labelled pending a
// citable source.
export const PRECURSOR_PRICE_RECORDS: PrecursorPriceRecord[] = [
  { precursor: 'fentanyl_precursors', country: 'China', iso3: 'CHN', region: 'Asia', year: 2020, priceUsdPerKg: 2500 },
  { precursor: 'fentanyl_precursors', country: 'China', iso3: 'CHN', region: 'Asia', year: 2022, priceUsdPerKg: 4200 },
  { precursor: 'fentanyl_precursors', country: 'Mexico', iso3: 'MEX', region: 'Americas', year: 2022, priceUsdPerKg: 9000 },
  { precursor: 'meth_precursors', country: 'China', iso3: 'CHN', region: 'Asia', year: 2021, priceUsdPerKg: 1200 },
  { precursor: 'meth_pre_precursors', country: 'China', iso3: 'CHN', region: 'Asia', year: 2022, priceUsdPerKg: 600 },
  { precursor: 'meth_precursors', country: 'Mexico', iso3: 'MEX', region: 'Americas', year: 2021, priceUsdPerKg: 3800 },
  { precursor: 'heroin_precursors', country: 'India', iso3: 'IND', region: 'Asia', year: 2021, priceUsdPerKg: 950 },
  { precursor: 'heroin_precursors', country: 'Afghanistan', iso3: 'AFG', region: 'Asia', year: 2021, priceUsdPerKg: 1500 },
]

// Approximate lat/lng centroids for the map view. 'European Union' is a
// display anchor (Brussels) for corridors INCB reports at EU grain; the
// 'China / India' joint-origin string has no anchor, so those corridors
// appear in the table but draw no arc (deliberate: we don't invent a split).
export const COUNTRY_CENTROIDS: Record<string, Centroid> = {
  'China': { lat: 35.9, lng: 104.2 },
  'India': { lat: 22.0, lng: 79.0 },
  'Mexico': { lat: 23.6, lng: -102.5 },
  'United States': { lat: 39.8, lng: -98.6 },
  'Myanmar': { lat: 21.9, lng: 95.9 },
  'Australia': { lat: -25.3, lng: 133.8 },
  'Afghanistan': { lat: 33.9, lng: 67.7 },
  'Thailand': { lat: 15.9, lng: 100.9 },
  'Laos': { lat: 19.9, lng: 102.5 },
  'Netherlands': { lat: 52.1, lng: 5.3 },
  'Germany': { lat: 51.2, lng: 10.4 },
  'European Union': { lat: 50.85, lng: 4.35 },
  'Morocco': { lat: 31.8, lng: -7.1 },
  'Türkiye': { lat: 39.0, lng: 35.2 },
  'Iran': { lat: 32.4, lng: 53.7 },
  'New Zealand': { lat: -41.5, lng: 172.8 },
  'Ecuador': { lat: -1.8, lng: -78.2 },
  'Colombia': { lat: 4.6, lng: -74.1 },
  'Democratic Republic of the Congo': { lat: -2.9, lng: 23.7 },
  'Egypt': { lat: 26.8, lng: 30.8 },
}
