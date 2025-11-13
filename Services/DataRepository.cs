using System.Text.Json;
using EmployeeManager.Models;

namespace EmployeeManager.Services
{
    public class DepartmentItem
    {
        public int Id { get; set; }
        public string? Name { get; set; }
        public string? Location { get; set; }
    }

        public class SkillItem
    {
        public int Id { get; set; }
        public string? Name { get; set; }
    }

    public class DataRepository
    {
        private readonly IWebHostEnvironment _env;
        public List<Employee> Employees { get; } = new List<Employee>();
        public List<DepartmentItem> Departments { get; } = new List<DepartmentItem>();
        public List<SkillItem> Skills { get; } = new List<SkillItem>();

        private readonly object _lock = new object();

        private int _nextId = 1;

        public DataRepository(IWebHostEnvironment env)
        {
            _env = env;
            Load();
        }

        public void SaveEmployees()
        {
            // Serialize current Employees list back to Data/Employer.json
            var dataDir = Path.Combine(_env.ContentRootPath ?? Directory.GetCurrentDirectory(), "Data");
            Directory.CreateDirectory(dataDir);
            var empPath = Path.Combine(dataDir, "Employer.json");

            // Map to the original Employer.json shape, include Skill if present
            var outList = Employees.Select(e =>
            {
                // try to find a skill id for the employee's skill name
                var skillName = e.Skill ?? string.Empty;
                var skillItem = Skills.FirstOrDefault(s => string.Equals(s.Name, skillName, StringComparison.OrdinalIgnoreCase));
                var skillId = skillItem?.Id ?? 0;
                return new
                {
                    EmployerID = e.Id,
                    EmployerName = e.FullName ?? string.Empty,
                    DepartmentId = e.DepartmentId,
                    SkillID = skillId,
                    Skill = skillName
                };
            }).ToList();

            var opts = new JsonSerializerOptions { WriteIndented = true };
            var json = JsonSerializer.Serialize(outList, opts);

            // Write atomically
            var tmp = empPath + ".tmp";
            lock (_lock)
            {
                File.WriteAllText(tmp, json);
                File.Copy(tmp, empPath, true);
                File.Delete(tmp);
            }
        }

        public void SaveSkills()
        {
            var dataDir = Path.Combine(_env.ContentRootPath ?? Directory.GetCurrentDirectory(), "Data");
            Directory.CreateDirectory(dataDir);
            var skillsPath = Path.Combine(dataDir, "Skills.json");
            var opts = new JsonSerializerOptions { WriteIndented = true };
            // Persist as array of objects with SkillID and SkillName
            var outSkills = Skills.Select(s => new { SkillID = s.Id, SkillName = s.Name }).ToList();
            var json = JsonSerializer.Serialize(outSkills, opts);
            var tmp = skillsPath + ".tmp";
            lock (_lock)
            {
                File.WriteAllText(tmp, json);
                File.Copy(tmp, skillsPath, true);
                File.Delete(tmp);
            }
        }
        private void Load()
        {
            var dataDir = Path.Combine(_env.ContentRootPath ?? Directory.GetCurrentDirectory(), "Data");
            // Load in logical order: skills, departments, then employees (employees may reference skills/departments)
            try
            {
                LoadSkills(dataDir);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Warning: failed to load skills: {ex.Message}");
                SeedDefaultSkills();
            }

            try
            {
                LoadDepartments(dataDir);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Warning: failed to load departments: {ex.Message}");
            }

            try
            {
                LoadEmployees(dataDir);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Warning: failed to load employees: {ex.Message}");
            }
        }

        private void LoadDepartments(string dataDir)
        {
            var deptPath = Path.Combine(dataDir, "Department.json");
            if (!File.Exists(deptPath)) return;
            var deptJson = File.ReadAllText(deptPath);
            var depts = JsonSerializer.Deserialize<List<JsonElement>>(deptJson) ?? new List<JsonElement>();
            Departments.Clear();
            foreach (var d in depts)
            {
                if (d.ValueKind != JsonValueKind.Object) continue;
                if (!d.TryGetProperty("DepartmentID", out var idProp) || idProp.ValueKind != JsonValueKind.Number) continue;
                int id = idProp.GetInt32();
                string name = d.TryGetProperty("DepartmentName", out var nameProp) ? nameProp.GetString() ?? id.ToString() : id.ToString();
                string location = d.TryGetProperty("Location", out var loc) ? loc.GetString() ?? string.Empty : string.Empty;
                Departments.Add(new DepartmentItem { Id = id, Name = name, Location = location });
            }
        }

        private void LoadSkills(string dataDir)
        {
            var skillsPath = Path.Combine(dataDir, "Skills.json");
            Skills.Clear();
            if (!File.Exists(skillsPath))
            {
                SeedDefaultSkills();
                return;
            }

            var skillsJson = File.ReadAllText(skillsPath);
            var items = JsonSerializer.Deserialize<List<JsonElement>>(skillsJson) ?? new List<JsonElement>();
            foreach (var it in items)
            {
                if (it.ValueKind == JsonValueKind.String)
                {
                    var v = it.GetString();
                    if (!string.IsNullOrWhiteSpace(v)) Skills.Add(new SkillItem { Id = 0, Name = v });
                }
                else if (it.ValueKind == JsonValueKind.Object)
                {
                    int id = 0;
                    if (it.TryGetProperty("SkillID", out var idProp) && idProp.ValueKind == JsonValueKind.Number)
                        id = idProp.GetInt32();
                    string? val = null;
                    if (it.TryGetProperty("SkillName", out var sn) && sn.ValueKind == JsonValueKind.String)
                        val = sn.GetString();
                    else if (it.TryGetProperty("Name", out var nm) && nm.ValueKind == JsonValueKind.String)
                        val = nm.GetString();
                    else if (it.TryGetProperty("Skill", out var sk) && sk.ValueKind == JsonValueKind.String)
                        val = sk.GetString();

                    if (!string.IsNullOrWhiteSpace(val)) Skills.Add(new SkillItem { Id = id, Name = val! });
                }
            }
            // ensure unique by name (case-insensitive)
            var uniq = Skills.GroupBy(s => s.Name, StringComparer.OrdinalIgnoreCase).Select(g => g.First()).ToList();
            Skills.Clear();
            Skills.AddRange(uniq);
            // ensure ids exist for items that lack them
            var nextSkillId = Skills.Where(s => s.Id > 0).Select(s => s.Id).DefaultIfEmpty(0).Max() + 1;
            for (int i = 0; i < Skills.Count; i++)
            {
                if (Skills[i].Id == 0) Skills[i].Id = nextSkillId++;
            }
        }

        private void LoadEmployees(string dataDir)
        {
            var empPath = Path.Combine(dataDir, "Employer.json");
            if (!File.Exists(empPath)) return;
            var empJson = File.ReadAllText(empPath);
            var emps = JsonSerializer.Deserialize<List<JsonElement>>(empJson) ?? new List<JsonElement>();
            Employees.Clear();
            foreach (var e in emps)
            {
                if (e.ValueKind != JsonValueKind.Object) continue;
                if (!e.TryGetProperty("EmployerID", out var idProp) || idProp.ValueKind != JsonValueKind.Number) continue;
                int id = idProp.GetInt32();
                string name = e.TryGetProperty("EmployerName", out var nm) && nm.ValueKind == JsonValueKind.String ? nm.GetString() ?? string.Empty : string.Empty;
                int deptId = e.TryGetProperty("DepartmentId", out var d) && d.ValueKind == JsonValueKind.Number ? d.GetInt32() : 0;
                // skill: prefer SkillID mapping to our Skills list, fall back to Skill string if present
                string skillVal = string.Empty;
                if (e.TryGetProperty("SkillID", out var skIdProp) && skIdProp.ValueKind == JsonValueKind.Number)
                {
                    var skId = skIdProp.GetInt32();
                    var sk = Skills.FirstOrDefault(s => s.Id == skId);
                    if (sk != null) skillVal = sk.Name ?? string.Empty;
                }
                else if (e.TryGetProperty("Skill", out var skProp) && skProp.ValueKind == JsonValueKind.String)
                {
                    skillVal = skProp.GetString() ?? string.Empty;
                }

                Employees.Add(new Employee { Id = id, FullName = name, DepartmentId = deptId, Skill = skillVal });
                if (id >= _nextId) _nextId = id + 1;
            }
        }

        private void SeedDefaultSkills()
        {
            var defaultSkills = new[] { "C#", "ASP.NET Core", "JavaScript", "TypeScript", "SQL", "Negotiation", "Recruiting", "Project Management", "Design", "Testing" };
            foreach (var ds in defaultSkills)
            {
                if (!Skills.Any(s => string.Equals(s.Name, ds, StringComparison.OrdinalIgnoreCase))) Skills.Add(new SkillItem { Id = 0, Name = ds });
            }
            // ensure ids assigned
            var nextSkillId = Skills.Where(s => s.Id > 0).Select(s => s.Id).DefaultIfEmpty(0).Max() + 1;
            for (int i = 0; i < Skills.Count; i++) if (Skills[i].Id == 0) Skills[i].Id = nextSkillId++;
        }

        public IEnumerable<string> GetMatchingSkills(string q)
        {
            var names = Skills.Select(s => s.Name ?? string.Empty);
            if (string.IsNullOrWhiteSpace(q)) return names.Take(20);
            return names.Where(n => n.IndexOf(q, StringComparison.OrdinalIgnoreCase) >= 0).Take(20);
        }
    }
}
