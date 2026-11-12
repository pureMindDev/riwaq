import { DailyPlan } from '../models/DailyPlan.js'

// Marks matching items of a day's plan as completed. `match` is e.g. { kind: 'revision', passage: id }.
export function createPlanItems() {
  return {
    async complete(userId, date, match) {
      const filters = {}
      for (const [k, v] of Object.entries(match)) filters[`it.${k}`] = v
      await DailyPlan.updateOne(
        { user: userId, date },
        { $set: { 'items.$[it].status': 'completed', 'items.$[it].completedAt': new Date() } },
        { arrayFilters: [{ ...filters, 'it.status': 'pending' }] },
      )
    },
  }
}
