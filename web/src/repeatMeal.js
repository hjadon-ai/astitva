// A recent record contains total nutrition for its recorded portion, not per-library serving.
export function repeatMealInput(meal, { date, mealType, quantity }) {
  const count = Number(quantity);
  return {
    date, name: meal.name, mealType,
    servingDescription: count === 1 ? meal.servingDescription || '' : `${count} × recorded portion: ${meal.servingDescription || 'meal'}`.slice(0, 80),
    nutrition: Object.fromEntries(Object.entries(meal.nutrition).map(([key, value]) => [key,
      key === 'calories' ? Math.round(value * count) : Math.round(value * count * 10) / 10]))
  };
}
