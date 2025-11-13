# Employee Manager - ASP.NET Core MVC
Create a small MVC application that allows managing a list of employees (add, edit,
delete) on a single page.
Data should be stored only in an in-memory list (no database required, but it should be
treated as if the data/models are stored in a database).
Functional Requirements

1. Display Employees
On the main page /Employees/Index, display a table of employees.
Each employee has the following fields:
Full Name (text)
Department (enum)
Skill (text with autocomplete – suggestions are fetched from the backend based on the
entered string in the frontend; the user can only select from existing items, custom input
is not allowed).

2. Add New Employee
At the bottom of the table, include a button “+ Add Employee” that adds a new row to
the table with empty fields.

3. Delete Employee
Each row should have a “Delete” button that removes the corresponding employee from
the list.

4. Save
At the bottom of the form, include a “Save All” button that submits all data to the
backend.
If the model is invalid (e.g., empty name), display validation errors on the screen.

5. Autocomplete
The “Skill” field should display suggestions from a backend method that returns a JSON
list of up to 20 items that match the filter by skill name (the filter applies anywhere
within the skill name).
You may use any existing autocomplete control.

6. Backend
The backend should include:
• Model(s)
• Controller
• View(s)
It is recommended to use the Bootstrap framework for styling and layout.

## Technical Requirements
Use ASP.NET Core MVC (.NET 8)
Data may be stored in a list inside the controller (no database required). An initial list of
employees can be arbitrary.
Before deleting an employee, display a confirmation message: “Are you sure you want to
delete this record?” . The employee is deleted only upon confirmation.
The Department field should be displayed as a dropdown.

## Validation:
• Client-side for required fields (e.g., Full Name)
• Server-side validation for all fields.
All variable names, methods, and other identifiers should be in English.

## Bonus Points
Extra credit will be given for:
• Using partial views or layout
• Using Bootstrap for improved appearance
• Implementing dynamic add/delete via JavaScript without page reload
Learning Objectives

## This assignment tests understanding of:
• MVC pattern (Model–View–Controller)
• Correct model binding for lists (List<T>)
• Display and submission of a complex model in a Razor view
• Working with enums in dropdowns
• AJAX calls and JSON responses (autocomplete)
• Validation and error handling
• Overall project structure and code readability

## Notes
The design does not need to be perfect – focus on functionality and clean,
understandable code.
You may use Bootstrap or jQuery, but they are not mandatory.
A Visual Studio MVC web project is included with this assignment.
