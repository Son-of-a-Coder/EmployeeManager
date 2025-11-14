using System.ComponentModel.DataAnnotations;

namespace EmployeeManager.Models
{
    public class Employee
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Full Name is required")]
        public string? FullName { get; set; }

        // Department is stored as an integer id (maps to department records from Data/Department.json)
        [Range(1, int.MaxValue, ErrorMessage = "Department is required")]
        public int DepartmentId { get; set; }

        [Required(ErrorMessage = "Skill is required")]
        public string? Skill { get; set; }
    }
}
