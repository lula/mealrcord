# mealrcord

`mealrcord` is an application intended to store recipes. A recipe has ingredients (for a base number of people). Ingredients can be shared among recipes. 

## Features

### Recipes list
List of recipes. 

### Recipe editor
A recipe has a name, description and a set of ingredients with their quantity and unit (ingredients can be reused among different recipes).
A recipe has also a set of optional tags:
- system tags: starter, first course, main corse, dessert. Cannot be deleted.
- custom tags: users can add their own tags, which can be deleted.

### Meals list
A meal is composed by a set of recipes. Users can search recipes to add by name or tag.
A meal may have 4 parts:
- starters
- first courses
- main courses
- desserts

All parts are optional, but at least one is mandatory to create the meal. 

A meal can also have a coefficient to decrease recipes quantities, in case for example a meal is composed by several recipes.

### Meal planner
Each day have different meals and people that attend the restuarant. The recipes in the meal planner detail should be declined for the number of people 
expected in that day. 

Meal planner has a calendar view (month, weekly, day), default is weekly. 

## Technical details
The application should be multiplaform. I was planning on using electron to create the multiplatform app, but propose otherwise in case you think something is else better suited for this app. The database should be in-app sqlite, but propose otherwise in case you think something is else better suited for this app.

For the frontend part use react and shadcn components for all ui. 