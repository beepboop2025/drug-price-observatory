import type {
  MmConflictEventRecord,
  MmFlowRecord,
  MmNode,
  MmPrecursorFlowRecord,
  MmRegionRecord,
} from '../types'

export interface EvidenceNode {
  id: string
  label: string
  kind: 'region' | 'actor' | 'country' | 'precursor' | 'source'
  weight: number
}

export interface EvidenceEdge {
  from: string
  to: string
  relation: 'reports' | 'conflict_pressure' | 'precursor_inflow' | 'drug_outflow'
  weight: number
  sourceName?: string
  sourceUrl?: string
}

export interface RegionRiskProfile {
  region: string
  label: string
  year: number
  riskScore: number
  confidenceScore: number
  sourceDiversity: number
  evidenceCount: number
  conflictPressure: number
  precursorPressure: number
  outflowPressure: number
  syntheticActivity: number
  opiumHa: number
  drivers: string[]
}

export interface IntelligenceBriefing {
  year: number
  profiles: RegionRiskProfile[]
  nodes: EvidenceNode[]
  edges: EvidenceEdge[]
  enterpriseReadiness: {
    provenanceCoveragePct: number
    multiSourceRegions: number
    highRiskRegions: number
    evidenceRecords: number
  }
}

const clamp = (value: number, min = 0, max = 100): number => Math.max(min, Math.min(max, value))

const confidenceWeight = (confidence: MmPrecursorFlowRecord['confidence']): number => {
  if (confidence === 'official') return 1
  if (confidence === 'reported') return 0.78
  return 0.55
}

const normalizedShare = (value: number, max: number): number => (max > 0 ? (value / max) * 100 : 0)

export function buildMyanmarIntelligenceBriefing(input: {
  year: number
  regions: MmNode[]
  regionRecords: MmRegionRecord[]
  conflictEvents: MmConflictEventRecord[]
  precursorFlows: MmPrecursorFlowRecord[]
  outflows: MmFlowRecord[]
}): IntelligenceBriefing {
  const { year, regions } = input
  const regionRecords = input.regionRecords.filter((r) => r.year === year)
  const conflictEvents = input.conflictEvents.filter((r) => r.year === year)
  const precursorFlows = input.precursorFlows.filter((r) => r.year === year)
  const outflows = input.outflows.filter((r) => r.year === year)
  const labelByRegion = new Map(regions.map((r) => [r.id, r.label]))

  const precursorByRegion = new Map<string, number>()
  for (const flow of precursorFlows) {
    const weighted = flow.quantityKg * confidenceWeight(flow.confidence)
    precursorByRegion.set(flow.to, (precursorByRegion.get(flow.to) ?? 0) + weighted)
  }

  const outflowByRegion = new Map<string, number>()
  for (const flow of outflows) {
    outflowByRegion.set(flow.from, (outflowByRegion.get(flow.from) ?? 0) + flow.quantityKg)
  }

  const conflictByRegion = new Map<string, number>()
  for (const event of conflictEvents) {
    conflictByRegion.set(event.region, Math.max(conflictByRegion.get(event.region) ?? 0, event.intensity))
  }

  const maxPrecursor = Math.max(0, ...precursorByRegion.values())
  const maxOutflow = Math.max(0, ...outflowByRegion.values())
  const maxOpium = Math.max(0, ...regionRecords.map((r) => r.opiumHa))

  const profiles = regions.map((region) => {
    const stat = regionRecords.find((r) => r.region === region.id)
    const conflictPressure = conflictByRegion.get(region.id) ?? 0
    const precursorPressure = normalizedShare(precursorByRegion.get(region.id) ?? 0, maxPrecursor)
    const outflowPressure = normalizedShare(outflowByRegion.get(region.id) ?? 0, maxOutflow)
    const syntheticActivity = stat?.methIndex ?? 0
    const opiumHa = stat?.opiumHa ?? 0
    const opiumPressure = normalizedShare(opiumHa, maxOpium)

    const regionSources = new Set<string>()
    conflictEvents.filter((r) => r.region === region.id).forEach((r) => regionSources.add(r.sourceName))
    precursorFlows.filter((r) => r.to === region.id).forEach((r) => regionSources.add(r.sourceName))
    const evidenceCount =
      conflictEvents.filter((r) => r.region === region.id).length +
      precursorFlows.filter((r) => r.to === region.id).length +
      outflows.filter((r) => r.from === region.id).length +
      (stat ? 1 : 0)

    const riskScore = clamp(
      conflictPressure * 0.25 +
      precursorPressure * 0.25 +
      outflowPressure * 0.2 +
      syntheticActivity * 0.2 +
      opiumPressure * 0.1,
    )
    const confidenceScore = clamp(
      Math.min(100, evidenceCount * 16) * 0.45 +
      Math.min(100, regionSources.size * 34) * 0.35 +
      (stat ? 20 : 0),
    )

    const drivers = [
      [conflictPressure, 'conflict pressure'],
      [precursorPressure, 'inbound precursor pressure'],
      [outflowPressure, 'seized outbound flow'],
      [syntheticActivity, 'synthetic-drug activity'],
      [opiumPressure, 'opium cultivation'],
    ]
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .slice(0, 3)
      .map(([, label]) => String(label))

    return {
      region: region.id,
      label: labelByRegion.get(region.id) ?? region.id,
      year,
      riskScore: Math.round(riskScore),
      confidenceScore: Math.round(confidenceScore),
      sourceDiversity: regionSources.size,
      evidenceCount,
      conflictPressure: Math.round(conflictPressure),
      precursorPressure: Math.round(precursorPressure),
      outflowPressure: Math.round(outflowPressure),
      syntheticActivity: Math.round(syntheticActivity),
      opiumHa,
      drivers,
    }
  }).sort((a, b) => b.riskScore - a.riskScore)

  const { nodes, edges } = buildEvidenceGraph({ regions, conflictEvents, precursorFlows, outflows })
  const regionsWithProvenance = profiles.filter((p) => p.evidenceCount > 1 && p.sourceDiversity > 0).length

  return {
    year,
    profiles,
    nodes,
    edges,
    enterpriseReadiness: {
      provenanceCoveragePct: regions.length ? Math.round((regionsWithProvenance / regions.length) * 100) : 0,
      multiSourceRegions: profiles.filter((p) => p.sourceDiversity >= 2).length,
      highRiskRegions: profiles.filter((p) => p.riskScore >= 70).length,
      evidenceRecords: conflictEvents.length + precursorFlows.length + outflows.length + regionRecords.length,
    },
  }
}

function buildEvidenceGraph(input: {
  regions: MmNode[]
  conflictEvents: MmConflictEventRecord[]
  precursorFlows: MmPrecursorFlowRecord[]
  outflows: MmFlowRecord[]
}): { nodes: EvidenceNode[]; edges: EvidenceEdge[] } {
  const nodeMap = new Map<string, EvidenceNode>()
  const edges: EvidenceEdge[] = []
  const upsert = (node: EvidenceNode) => {
    const existing = nodeMap.get(node.id)
    nodeMap.set(node.id, existing ? { ...existing, weight: Math.max(existing.weight, node.weight) } : node)
  }

  for (const region of input.regions) {
    upsert({ id: `region:${region.id}`, label: region.label, kind: 'region', weight: 1 })
  }

  for (const event of input.conflictEvents) {
    upsert({ id: `actor:${event.actor}`, label: event.actor, kind: 'actor', weight: event.intensity })
    upsert({ id: `source:${event.sourceName}`, label: event.sourceName, kind: 'source', weight: 1 })
    edges.push({
      from: `actor:${event.actor}`,
      to: `region:${event.region}`,
      relation: 'conflict_pressure',
      weight: event.intensity,
      sourceName: event.sourceName,
      sourceUrl: event.sourceUrl,
    })
    edges.push({
      from: `source:${event.sourceName}`,
      to: `actor:${event.actor}`,
      relation: 'reports',
      weight: 1,
      sourceName: event.sourceName,
      sourceUrl: event.sourceUrl,
    })
  }

  for (const flow of input.precursorFlows) {
    upsert({ id: `country:${flow.originCountry}`, label: flow.originCountry, kind: 'country', weight: flow.quantityKg })
    upsert({ id: `precursor:${flow.precursor}`, label: flow.precursor.replace(/_/g, ' '), kind: 'precursor', weight: flow.quantityKg })
    upsert({ id: `source:${flow.sourceName}`, label: flow.sourceName, kind: 'source', weight: 1 })
    edges.push({
      from: `country:${flow.originCountry}`,
      to: `region:${flow.to}`,
      relation: 'precursor_inflow',
      weight: flow.quantityKg * confidenceWeight(flow.confidence),
      sourceName: flow.sourceName,
      sourceUrl: flow.sourceUrl,
    })
    edges.push({
      from: `source:${flow.sourceName}`,
      to: `country:${flow.originCountry}`,
      relation: 'reports',
      weight: confidenceWeight(flow.confidence),
      sourceName: flow.sourceName,
      sourceUrl: flow.sourceUrl,
    })
  }

  for (const flow of input.outflows) {
    edges.push({
      from: `region:${flow.from}`,
      to: `region:${flow.to}`,
      relation: 'drug_outflow',
      weight: flow.quantityKg,
    })
  }

  return { nodes: [...nodeMap.values()], edges }
}
