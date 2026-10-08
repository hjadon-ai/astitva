export function updateWaterIntake(water, {entry, deletedId}) {
  const entries = deletedId ? water.entries.filter(item => item.id !== deletedId) : [...water.entries.filter(item => item.id !== entry.id), entry];
  const consumedMilliliters = entries.reduce((total,item) => total + item.amountMilliliters, 0);
  const target = water.targetMilliliters;
  return {...water, entries, consumedMilliliters,
    remainingMilliliters: target == null ? null : Math.max(0,target-consumedMilliliters),
    overTargetMilliliters: target == null ? null : Math.max(0,consumedMilliliters-target)};
}
