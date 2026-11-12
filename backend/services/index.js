// Builds every service once and wires them together (a tiny dependency-injection container).
import { createQuranService } from './quranFoundation.js'
import { createRecitationEngine } from './recitationEngine.js'
import { createPlanItems } from './planItems.js'
import { createRevisionService } from './revisionService.js'
import { createMilestoneService } from './milestoneService.js'
import { createPassageService } from './passageService.js'
import { createStudentService } from './studentService.js'
import { createFoundationService } from './foundationService.js'
import { createAssessmentService } from './assessmentService.js'
import { createAuthService } from './authService.js'
import { createPlanService } from './planService.js'
import { createRecitationAssessmentService } from './recitationAssessmentService.js'

export function createServices({ config, fetchImpl }) {
  const quran = createQuranService({ config, fetchImpl })
  const engine = createRecitationEngine({ config, fetchImpl })
  const planItems = createPlanItems()
  const hooks = {}
  const revision = createRevisionService({ config, planItems, hooks })
  const milestones = createMilestoneService({ config, quran, revision })
  hooks.afterRevise = (userId, timezone) => milestones.evaluate(userId, timezone)
  const passages = createPassageService({ config, quran, milestones, planItems })
  const student = createStudentService({ quran, milestones })
  const foundation = createFoundationService({ config, planItems })
  const assessment = createAssessmentService()
  const auth = createAuthService({ config })
  const plan = createPlanService({ quran, passages, milestones, foundation, student })
  const recitation = createRecitationAssessmentService({ quran, engine, passages })
  return { config, quran, engine, planItems, revision, milestones, passages, student, foundation, assessment, auth, plan, recitation }
}
