import { poems } from '../src/data/poems'
import { schoolPoems, schoolPoemTextKey } from '../src/data/schoolPoems'
import { schoolPoemSeeds } from '../src/data/schoolPoems.generated'
import { elevateNearbyPoemPlaces } from '../src/lib/poemPlaces'

const expectedCurriculumPoems = 194
const publishedByText = new Map(
  poems.map((poem) => [schoolPoemTextKey(poem), poem]),
)
const missing = schoolPoems.filter((poem) => !publishedByText.has(schoolPoemTextKey(poem)))

if (schoolPoemSeeds.length !== expectedCurriculumPoems) {
  throw new Error(`Expected ${expectedCurriculumPoems} curriculum poems, found ${schoolPoemSeeds.length}`)
}
if (missing.length > 0) {
  throw new Error(`Missing curriculum poems: ${missing.map((poem) => poem.title).join('、')}`)
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
  maximumLiftTier: Math.max(...elevateNearbyPoemPlaces(poems).map((place) => place.liftTier)),
}, null, 2))
