import { describe, it, assert } from 'vitest';
import {
  parsePrices,
  parsePrecursorPrices,
  parseFlows,
  parseMyanmarRegions,
  parseMyanmarBorderNodes,
  parseMyanmarRegionRecords,
  parseMyanmarFlows,
  parseMyanmarConflictEvents,
  parseMyanmarPrecursorFlows,
} from './ingest';

describe('parsePrices', () => {
  it('parses a clean retail-price row', () => {
    const csv = `drug,country,iso3,region,year,priceUsdPerGram,purityPct
Cocaine,Colombia,COL,South America,2023,45.5,78.5`;

    const { records, warnings } = parsePrices(csv);

    assert.equal(records.length, 1);
    assert.equal(warnings.length, 0);
    assert.deepEqual(records[0], {
      drug: 'cocaine',
      country: 'Colombia',
      iso3: 'COL',
      region: 'South America',
      year: 2023,
      priceUsdPerGram: 45.5,
      purityPct: 78.5,
    });
  });

  it('treats empty / "-" / "n/a" purity as null', () => {
    const csv = `drug,country,iso3,region,year,priceUsdPerGram,purityPct
Heroin,Afghanistan,AFG,Asia,2023,12,-
Cannabis,Mexico,MEX,North America,2023,3.5,n/a
Methamphetamine,Thailand,THA,Asia,2023,25.0,`;

    const { records, warnings } = parsePrices(csv);

    assert.equal(records.length, 3);
    assert.equal(warnings.length, 0);
    assert.equal(records[0].purityPct, null);
    assert.equal(records[1].purityPct, null);
    assert.equal(records[2].purityPct, null);
  });

  it('skips a row with a malformed numeric and records a warning', () => {
    const csv = `drug,country,iso3,region,year,priceUsdPerGram,purityPct
Cocaine,Peru,PER,South America,2023,not_a_number,80`;

    const { records, warnings } = parsePrices(csv);

    assert.equal(records.length, 0);
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes('missing required fields'));
  });

  it('skips a row with a negative price and records a warning', () => {
    const csv = `drug,country,iso3,region,year,priceUsdPerGram,purityPct
Heroin,Myanmar,MMR,Asia,2023,-5,60`;

    const { records, warnings } = parsePrices(csv);

    assert.equal(records.length, 0);
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes('negative priceUsdPerGram'));
  });

  it('falls back gracefully when headers use unknown synonyms', () => {
    const csv = `Substance,Nation,ISO Code,Regional Group,Year,Retail Price USD/g,Purity %
Cocaine,Colombia,COL,South America,2023,45.5,80`;

    const { records, warnings } = parsePrices(csv);

    assert.equal(records.length, 1);
    assert.equal(warnings.length, 0);
    assert.equal(records[0].drug, 'cocaine');
    assert.equal(records[0].priceUsdPerGram, 45.5);
  });

  it('clamps purityPct to the [0, 100] range', () => {
    const csv = `drug,country,iso3,region,year,priceUsdPerGram,purityPct
Cocaine,Brazil,BRA,South America,2023,50,-5
Cannabis,USA,USA,North America,2023,10,105`;

    const { records, warnings } = parsePrices(csv);

    assert.equal(records.length, 2);
    assert.equal(records[0].purityPct, 0);
    assert.equal(records[1].purityPct, 100);
  });

  it('handles escaped quotes inside quoted CSV fields', () => {
    const csv = `drug,country,iso3,region,year,priceUsdPerGram,purityPct
"Cocaine","Colombia, ""official""",COL,South America,2023,45.5,80`;

    const { records, warnings } = parsePrices(csv);

    assert.equal(records.length, 1);
    assert.equal(warnings.length, 0);
    assert.equal(records[0].country, 'Colombia, "official"');
  });
});

describe('parsePrecursorPrices', () => {
  it('parses a clean precursor-price row', () => {
    const csv = `precursor,country,iso3,region,year,priceUsdPerKg
meth_precursors,China,CHN,Asia,2023,2500`;

    const { records, warnings } = parsePrecursorPrices(csv);

    assert.equal(records.length, 1);
    assert.equal(warnings.length, 0);
    assert.deepEqual(records[0], {
      precursor: 'meth_precursors',
      country: 'China',
      iso3: 'CHN',
      region: 'Asia',
      year: 2023,
      priceUsdPerKg: 2500,
    });
  });

  it('skips a row with a negative precursor price', () => {
    const csv = `precursor,country,iso3,region,year,priceUsdPerKg
heroin_precursors,Myanmar,MMR,Asia,2023,-100`;

    const { records, warnings } = parsePrecursorPrices(csv);

    assert.equal(records.length, 0);
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes('negative priceUsdPerKg'));
  });
});

describe('parseFlows', () => {
  it('parses a clean flow row with no transit', () => {
    const csv = `precursor,origin,transit,destination,year,quantityKg
meth_precursors,China,,Mexico,2023,500`;

    const { records, warnings } = parseFlows(csv);

    assert.equal(records.length, 1);
    assert.equal(warnings.length, 0);
    assert.deepEqual(records[0], {
      precursor: 'meth_precursors',
      origin: 'China',
      transit: null,
      destination: 'Mexico',
      year: 2023,
      quantityKg: 500,
    });
  });

  it('skips a row with a negative quantity', () => {
    const csv = `precursor,origin,transit,destination,year,quantityKg
heroin_precursors,Myanmar,,Thailand,2023,-10`;

    const { records, warnings } = parseFlows(csv);

    assert.equal(records.length, 0);
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes('negative quantityKg'));
  });
});


describe('parseMyanmarRegions', () => {
  it('parses a clean region row', () => {
    const csv = `id,label,lat,lng
shan_north,Shan (North),21.5,98.0`;

    const { records, warnings } = parseMyanmarRegions(csv);

    assert.equal(records.length, 1);
    assert.equal(warnings.length, 0);
    assert.deepEqual(records[0], {
      id: 'shan_north',
      label: 'Shan (North)',
      lat: 21.5,
      lng: 98,
    });
  });

  it('drops extra source columns from the output', () => {
    const csv = `id,label,lat,lng,facility_name,precise_coord
shan_north,Shan (North),21.5,98.0,Lab A,21.5123`;

    const { records, warnings } = parseMyanmarRegions(csv);

    assert.equal(records.length, 1);
    assert.deepEqual(records[0], {
      id: 'shan_north',
      label: 'Shan (North)',
      lat: 21.5,
      lng: 98,
    });
  });
});

describe('parseMyanmarRegionRecords', () => {
  it('clamps methIndex to [0, 100]', () => {
    const csv = `region,year,opiumHa,methIndex
shan_north,2023,15000,130`;

    const { records, warnings } = parseMyanmarRegionRecords(csv);

    assert.equal(records.length, 1);
    assert.equal(warnings.length, 0);
    assert.equal(records[0].methIndex, 100);
  });
});

describe('parseMyanmarFlows', () => {
  it('skips a row with a negative quantityKg and records a warning', () => {
    const csv = `from,to,year,quantityKg,drug
shan_north,wa,2023,-500,Methamphetamine`;

    const { records, warnings } = parseMyanmarFlows(csv);

    assert.equal(records.length, 0);
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes('negative quantityKg'));
  });

  it('skips a row with an unknown drug and records a warning', () => {
    const csv = `from,to,year,quantityKg,drug
shan_north,wa,2023,500,Cocaine`;

    const { records, warnings } = parseMyanmarFlows(csv);

    assert.equal(records.length, 0);
    assert.equal(warnings.length, 1);
    assert.ok(
      warnings[0].includes('missing required fields') || warnings[0].includes('unknown drug')
    );
  });

  it('keeps a row with an unknown node id when knownIds is provided and records a warning', () => {
    const csv = `from,to,year,quantityKg,drug
unknown_region,wa,2023,500,Methamphetamine`;

    const { records, warnings } = parseMyanmarFlows(
      csv,
      new Set(['shan_north', 'wa'])
    );

    assert.equal(records.length, 1);
    assert.equal(warnings.length, 1);
    assert.equal(records[0].from, 'unknown_region');
    assert.ok(warnings[0].includes('unknown from id'));
  });

  it('drops extra source columns from the output', () => {
    const csv = `from,to,year,quantityKg,drug,route_detail
shan_north,wa,2023,500,Methamphetamine,secret trail`;

    const { records, warnings } = parseMyanmarFlows(csv);

    assert.equal(records.length, 1);
    assert.deepEqual(records[0], {
      from: 'shan_north',
      to: 'wa',
      year: 2023,
      quantityKg: 500,
      drug: 'Methamphetamine',
    });
  });

  describe('parseMyanmarConflictEvents', () => {
    it('parses a conflict event and normalizes actor/event types', () => {
      const csv = `region,year,actor,actorType,eventType,intensity,sourceName,sourceUrl
  Shan North,2023,Border militias,militia,territory,120,ACLED,https://acleddata.com/asia-pacific/myanmar/`;

      const { records, warnings } = parseMyanmarConflictEvents(csv, new Set(['shan_north']));

      assert.equal(records.length, 1);
      assert.equal(warnings.length, 0);
      assert.deepEqual(records[0], {
        region: 'shan_north',
        year: 2023,
        actor: 'Border militias',
        actorType: 'militia',
        eventType: 'territorial_control',
        intensity: 100,
        sourceName: 'ACLED',
        sourceUrl: 'https://acleddata.com/asia-pacific/myanmar/',
      });
    });

    it('keeps unknown regions but reports them', () => {
      const csv = `region,year,actor,actorType,eventType,intensity,sourceName,sourceUrl
  Unknown,2023,Group,other,clash,20,Source,https://example.org`;

      const { records, warnings } = parseMyanmarConflictEvents(csv, new Set(['shan_north']));

      assert.equal(records.length, 1);
      assert.equal(warnings.length, 1);
      assert.ok(warnings[0].includes('unknown region id'));
    });
  });

  describe('parseMyanmarPrecursorFlows', () => {
    it('parses country-to-region precursor inflows', () => {
      const csv = `originCountry,transitCountry,to,year,precursor,quantityKg,sourceName,sourceUrl,confidence
  China,Laos,Wa,2023,meth_precursors,1200,INCB,https://www.incb.org/incb/en/precursors/,official`;

      const { records, warnings } = parseMyanmarPrecursorFlows(csv, new Set(['wa']));

      assert.equal(records.length, 1);
      assert.equal(warnings.length, 0);
      assert.deepEqual(records[0], {
        originCountry: 'China',
        transitCountry: 'Laos',
        to: 'wa',
        year: 2023,
        precursor: 'meth_precursors',
        quantityKg: 1200,
        sourceName: 'INCB',
        sourceUrl: 'https://www.incb.org/incb/en/precursors/',
        confidence: 'official',
      });
    });

    it('skips unknown precursor classes', () => {
      const csv = `originCountry,to,year,precursor,quantityKg,sourceName,sourceUrl
  China,wa,2023,unknown,1200,INCB,https://www.incb.org/incb/en/precursors/`;

      const { records, warnings } = parseMyanmarPrecursorFlows(csv);

      assert.equal(records.length, 0);
      assert.equal(warnings.length, 1);
      assert.ok(warnings[0].includes('unknown precursor'));
    });
  });
});
