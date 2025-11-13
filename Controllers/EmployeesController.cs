using EmployeeManager.Models;
using EmployeeManager.Services;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;

namespace EmployeeManager.Controllers
{
    public class EmployeesController : Controller
    {
        private readonly DataRepository _repo;

        public EmployeesController(DataRepository repo)
        {
            _repo = repo;
        }

        public IActionResult Index()
        {
            // Provide a copy to the view
            var model = _repo.Employees.Select(e => new Employee { Id = e.Id, FullName = e.FullName, DepartmentId = e.DepartmentId, Skill = e.Skill }).ToList();
            ViewData["Skills"] = _repo.Skills.Select(s => s.Name ?? string.Empty).ToList();
            ViewData["Departments"] = _repo.Departments;
            return View(model);
        }

        [HttpGet]
        public IActionResult GetSkills(string q)
        {
            var matches = _repo.GetMatchingSkills(q);
            return Json(matches);
        }

        [HttpGet]
        public IActionResult GetAllSkills()
        {
            return Json(_repo.Skills.Select(s => s.Name));
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult Delete(int id)
        {
            var found = _repo.Employees.FirstOrDefault(e => e.Id == id);
            if (found == null)
            {
                return Json(new { success = false, message = "Not found" });
            }

            _repo.Employees.Remove(found);
            try
            {
                _repo.SaveEmployees();
            }
            catch
            {
                // persist failure shouldn't crash the API; return failure to client
                return Json(new { success = false, message = "Failed to persist data" });
            }

            return Json(new { success = true });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult SaveAll(List<Employee> employees)
        {
            for (int i = 0; i < employees.Count; i++)
            {
                var emp = employees[i];
                var context = new ValidationContext(emp);
                var results = new List<ValidationResult>();
                if (!Validator.TryValidateObject(emp, context, results, true))
                {
                    foreach (var r in results)
                    {
                        var member = r.MemberNames.FirstOrDefault() ?? string.Empty;
                        ModelState.AddModelError($"employees[{i}].{member}", r.ErrorMessage ?? "Invalid");
                    }
                }

                // Skill: required. If it's new, add it to the repository so it will be persisted.
                if (string.IsNullOrWhiteSpace(emp.Skill))
                {
                    ModelState.AddModelError($"employees[{i}].Skill", "Skill is required.");
                }
                else if (!_repo.Skills.Any(s => string.Equals(s.Name, emp.Skill, System.StringComparison.OrdinalIgnoreCase)))
                {
                    // Add new skill to in-memory list (will persist after save)
                    var nextSkillId = _repo.Skills.Where(s => s.Id > 0).Select(s => s.Id).DefaultIfEmpty(0).Max() + 1;
                    _repo.Skills.Add(new SkillItem { Id = nextSkillId, Name = emp.Skill });
                }

                // DepartmentId must exist in departments list
                if (!_repo.Departments.Any(d => d.Id == emp.DepartmentId))
                {
                    ModelState.AddModelError($"employees[{i}].DepartmentId", "Please select a valid department.");
                }
            }

            if (!ModelState.IsValid)
            {
                ViewData["Skills"] = _repo.Skills.Select(s => s.Name ?? string.Empty).ToList();
                ViewData["Departments"] = _repo.Departments;
                return View("Index", employees);
            }

            // Replace repository employees list
            _repo.Employees.Clear();
            // determine next id starting point
            var nextId = _repo.Employees.Any() ? _repo.Employees.Max(e => e.Id) + 1 : 1;
            foreach (var emp in employees)
            {
                if (emp.Id == 0)
                {
                    emp.Id = nextId++;
                }
                _repo.Employees.Add(new Employee { Id = emp.Id, FullName = emp.FullName, DepartmentId = emp.DepartmentId, Skill = emp.Skill });
            }

            try
            {
                _repo.SaveEmployees();
                // persist skills as well (including any new ones added above)
                _repo.SaveSkills();
            }
            catch
            {
                // If saving fails, re-display with an error
                ModelState.AddModelError(string.Empty, "Failed to save data to disk.");
                ViewData["Skills"] = _repo.Skills.Select(s => s.Name ?? string.Empty).ToList();
                ViewData["Departments"] = _repo.Departments;
                return View("Index", employees);
            }

            return RedirectToAction(nameof(Index));
        }
    }
}
