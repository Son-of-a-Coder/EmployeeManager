using Microsoft.AspNetCore.Mvc;

namespace DemoWebMvc.Controllers
{
    public class HomeController: Controller
    {

        public IActionResult Index()
        {
            return View();
        }

    }
}
