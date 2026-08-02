import { poems } from '../src/data/poems'
import { schoolPoems, schoolPoemTextKey } from '../src/data/schoolPoems'
import { schoolPoemSeeds } from '../src/data/schoolPoems.generated'
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

if (schoolPoemSeeds.length !== expectedCurriculumPoems) {
  throw new Error(`Expected ${expectedCurriculumPoems} curriculum poems, found ${schoolPoemSeeds.length}`)
}
if (missing.length > 0) {
  throw new Error(`Missing curriculum poems: ${missing.map((poem) => poem.title).join('、')}`)
}
if (genericPlaces.length > 0) {
  throw new Error(`Generic city-only poem places: ${genericPlaces.map((poem) => `${poem.title}=${poem.placeName}`).join('、')}`)
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
  genericCityOnlyPlaces: genericPlaces.length,
  relationCounts: Object.fromEntries(
    [...new Set(poems.map((poem) => poem.relation))]
      .map((relation) => [relation, poems.filter((poem) => poem.relation === relation).length]),
  ),
  confidenceCounts: Object.fromEntries(
    [...new Set(poems.map((poem) => poem.confidence))]
      .map((confidence) => [confidence, poems.filter((poem) => poem.confidence === confidence).length]),
  ),
  maximumLiftTier: Math.max(...elevateNearbyPoemPlaces(poems).map((place) => place.liftTier)),
}, null, 2))
