using Microsoft.AspNetCore.Mvc;

namespace DemoWebMvc.Controllers
{
    public class EmployeesController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
