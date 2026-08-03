import { poems } from '../src/data/poems'
import { schoolPoems, schoolPoemTextKey } from '../src/data/schoolPoems'
import { schoolPoemSeeds } from '../src/data/schoolPoems.generated'
import { schoolPoemDateCorrections } from '../src/data/schoolPoemDates'
import { elevateNearbyPoemPlaces } from '../src/lib/poemPlaces'

const expectedCurriculumPoems = 194
const publishedByText = new Map(
  poems.map((poem) => [schoolPoemTextKey(poem), poem]),
)
const missing = schoolPoems.filter((poem) => !publishedByText.has(schoolPoemTextKey(poem)))
const genericCityLabels = new Set([
  '长安', '洛阳', '扬州', '苏州', '杭州', '成都', '汴京', '临安城',
  '永嘉', '宜州', '金陵', '京师', '镇江', '凤翔', '高邮', '平城',
  '沛县', '溧阳', '渭城', '邺城', '朝歌', '丰镐',
])
const genericPlaces = poems.filter((poem) => genericCityLabels.has(poem.placeName))
const genericDates = poems.filter((poem) =>
  /教材篇目/u.test(poem.eraLabel)
  || /^(先秦|汉代|魏晋|南北朝|隋代|唐代|五代|宋代|元代|明代|清代)$/u.test(poem.yearLabel),
)

if (schoolPoemSeeds.length !== expectedCurriculumPoems) {
  throw new Error(`Expected ${expectedCurriculumPoems} curriculum poems, found ${schoolPoemSeeds.length}`)
}
if (missing.length > 0) {
  throw new Error(`Missing curriculum poems: ${missing.map((poem) => poem.title).join('、')}`)
}
if (genericPlaces.length > 0) {
  throw new Error(`Generic city-only poem places: ${genericPlaces.map((poem) => `${poem.title}=${poem.placeName}`).join('、')}`)
}
if (Object.keys(schoolPoemDateCorrections).length !== expectedCurriculumPoems) {
  throw new Error(`Expected ${expectedCurriculumPoems} poem-level dates, found ${Object.keys(schoolPoemDateCorrections).length}`)
}
if (genericDates.length > 0) {
  throw new Error(`Generic dynasty-only poem dates: ${genericDates.map((poem) => poem.title).join('、')}`)
}

const periodCounts = Object.fromEntries(
  [...new Set(poems.map((poem) => poem.dynasty))]
    .map((dynasty) => [dynasty, poems.filter((poem) => poem.dynasty === dynasty).length]),
)

console.log(JSON.stringify({
  totalPublished: poems.length,
  curriculumPublished: poems.filter((poem) => poem.curriculumLevels).length,
  primary: poems.filter((poem) => poem.curriculumLevels?.includes('primary')).length,
  middle: poems.filter((poem) => poem.curriculumLevels?.includes('middle')).length,
  periodCounts,
  individuallyEvidencedPlaces: poems.filter((poem) => poem.evidence.trim().length >= 18).length,
  individuallyEvidencedDates: poems.filter((poem) => poem.dateEvidence.trim().length >= 24).length,
  genericCityOnlyPlaces: genericPlaces.length,
  genericDynastyOnlyDates: genericDates.length,
  relationCounts: Object.fromEntries(
    [...new Set(poems.map((poem) => poem.relation))]
      .map((relation) => [relation, poems.filter((poem) => poem.relation === relation).length]),
  ),
  confidenceCounts: Object.fromEntries(
    [...new Set(poems.map((poem) => poem.confidence))]
      .map((confidence) => [confidence, poems.filter((poem) => poem.confidence === confidence).length]),
  ),
  datePrecisionCounts: Object.fromEntries(
    [...new Set(poems.map((poem) => poem.datePrecision))]
      .map((precision) => [precision, poems.filter((poem) => poem.datePrecision === precision).length]),
  ),
  datePrecisionByPeriod: Object.fromEntries(
    [...new Set(poems.map((poem) => poem.dynasty))].map((dynasty) => {
      const periodPoems = poems.filter((poem) => poem.dynasty === dynasty)
      return [dynasty, Object.fromEntries(
        [...new Set(periodPoems.map((poem) => poem.datePrecision))]
          .map((precision) => [
            precision,
            periodPoems.filter((poem) => poem.datePrecision === precision).length,
          ]),
      )]
    }),
  ),
  maximumLiftTier: Math.max(...elevateNearbyPoemPlaces(poems).map((place) => place.liftTier)),
}, null, 2))
