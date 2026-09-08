$(function () {
    // safe globals
    let allowedSkills = globalThis.allowedSkills || [];
    globalThis.allowedSkills = allowedSkills;

    function refreshAllSkills() {
        // return the jqXHR so callers can wait for completion
        return $.get('/Employees/GetAllSkills').done(function (data) {
            globalThis.allowedSkills = allowedSkills = data || [];
        }).fail(function () {
            // keep previous value if request fails
            globalThis.allowedSkills = allowedSkills = globalThis.allowedSkills || [];
        });
    }

    // initially load allowed skills (async)
    refreshAllSkills();

    // Typeahead implementation for `.skill` inputs (fetches suggestions from server)
    function bindSkillAutocomplete() {
        let activeRequest = null;
        let debounceTimer = null;

        function positionList($list, $input) {
            const rect = $input[0].getBoundingClientRect();
            $list.css({
                position: 'absolute',
                left: rect.left + window.pageXOffset + 'px',
                top: rect.bottom + window.pageYOffset + 'px',
                minWidth: Math.max(200, rect.width) + 'px',
                zIndex: 2000
            });
        }

        function createList() {
            return $('<div class="typeahead-suggestions list-group"></div>').appendTo('body').hide();
        }

        function hideList($list) {
            $list?.hide().empty();
        }

        // handle keyboard navigation inside suggestion list
        function handleKey(e, $input, $list) {
            const $items = $list.find('.list-group-item');
            if (!$items.length) return;
            let idx = $items.index($items.filter('.active'));
            if (e.key === 'ArrowDown') {
                idx = Math.min($items.length - 1, idx + 1);
                $items.removeClass('active').eq(idx).addClass('active');
                e.preventDefault();
            } else if (e.key === 'ArrowUp') {
                idx = Math.max(0, idx - 1);
                $items.removeClass('active').eq(idx).addClass('active');
                e.preventDefault();
            } else if (e.key === 'Enter') {
                const $sel = $items.filter('.active').first();
                if ($sel.length) {
                    $input.val($sel.text()).trigger('input');
                    hideList($list);
                    e.preventDefault();
                }
            } else if (e.key === 'Escape') {
                hideList($list);
            }
        }

        // attach handlers via delegation so dynamically added rows work
        $(document).on('focus', '.skill', function () {
            const $input = $(this);
            let $list = $input.data('typeaheadList');
            if (!$list) {
                $list = createList();
                $input.data('typeaheadList', $list);
            }
            positionList($list, $input);
        });

        $(document).on('blur', '.skill', function () {
            const $input = $(this);
            const $list = $input.data('typeaheadList');
            setTimeout(function () { hideList($list); }, 150);
        });

        $(document).on('keydown', '.skill', function (e) {
            const $input = $(this);
            const $list = $input.data('typeaheadList');
            if ($list && $list.is(':visible')) {
                handleKey(e, $input, $list);
                // Prevent form submit on Enter if suggestion list is open
                if (e.key === 'Enter') {
                    e.preventDefault();
                    return false;
                }
            }
            // Prevent form submit on Enter in skill input if not selecting suggestion
            if (e.key === 'Enter') {
                e.preventDefault();
                return false;
            }
        });

        $(document).on('input', '.skill', function () {
            const $input = $(this);
            const q = String($input.val() || '').trim();
            let $list = $input.data('typeaheadList');
            if (!$list) {
                $list = createList();
                $input.data('typeaheadList', $list);
            }
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(function () {
                if (activeRequest && activeRequest.abort) {
                    try { activeRequest.abort(); } catch (e) { }
                }
                activeRequest = $.get('/Employees/GetSkills', { q: q }).done(function (data) {
                    $list.empty();
                    if (!data || !data.length) {
                        hideList($list);
                        return;
                    }
                    data.forEach(function (item) {
                        var $it = $('<button type="button" class="list-group-item list-group-item-action"></button>').text(item);
                        $it.on('mousedown', function (ev) {
                            // use mousedown so value is set before blur
                            $input.val(item).trigger('input');
                            hideList($list);
                            ev.preventDefault();
                        });
                        $it.on('click', function (ev) {
                            $input.val(item).trigger('input');
                            hideList($list);
                            ev.preventDefault();
                        });
                        $list.append($it);
                    });
                    positionList($list, $input);
                    $list.show();
                }).fail(function () {
                    hideList($list);
                }).always(function () { activeRequest = null; });
            }, 200);
        });

        // reposition suggestion box on window resize/scroll
        $(window).on('resize scroll', function () {
            $('.skill').each(function () {
                const $input = $(this);
                const $list = $input.data('typeaheadList');
                if ($list?.is(':visible')) positionList($list, $input);
            });
        });
    }

        // Utility: reindex rows so model binding uses sequential indexes
        function reindexRows() {
            $('#employees-body tr').each(function (i) {
                const $tr = $(this);
                // hidden id
                $tr.find('input[type="hidden"]').attr('name', 'employees[' + i + '].Id');
                $tr.find('input[name$=".FullName"]').attr('name', 'employees[' + i + '].FullName').attr('id', 'employees_' + i + '__FullName');
                $tr.find('select[name$=".DepartmentId"]').attr('name', 'employees[' + i + '].DepartmentId').attr('id', 'employees_' + i + '__DepartmentId');
                $tr.find('[name$=".Skill"]').attr('name', 'employees[' + i + '].Skill').attr('id', 'employees_' + i + '__Skill');
                // store index on buttons
                $tr.find('.edit-btn').attr('data-index', i);
                $tr.find('.delete-btn').attr('data-index', i);
            });
            nextIndex = $('#employees-body tr').length;
            // reparse validation
            if ($.validator && $.validator.unobtrusive) {
                $.validator.unobtrusive.parse($('#employees-body'));
            }
        }

        // Delete handler: if persisted id > 0, send request to server, otherwise just remove row
        $(document).on('click', '.delete-btn', function (e) {
            e.preventDefault();
            const $btn = $(this);
            const $row = $btn.closest('tr');
            const id = Number.parseInt($btn.attr('data-id') || '0');
            if (id > 0) {
                if (!confirm('Are you sure you want to delete this record?')) return;
                const token = $('input[name="__RequestVerificationToken"]').val();
                $.post({
                    url: '/Employees/Delete',
                    data: { id: id, __RequestVerificationToken: token },
                    success: function (resp) {
                        if (resp && resp.success) {
                            $row.remove();
                            reindexRows();
                        } else {
                            alert(resp && resp.message ? resp.message : 'Delete failed');
                        }
                    }
                });
            } else {
                $row.remove();
                reindexRows();
            }
        });

        // Add new row (inline) — insert an empty row at the bottom for immediate editing and persist via AJAX when filled
        var nextIndex = $('#employees-body tr').length;
        $('#add-employee').on('click', function (e) {
            e.preventDefault();
            const idx = nextIndex++;
            let tpl = $('#new-row-template').html();
            tpl = tpl.replaceAll('__INDEX__', idx);
            const $row = $('<tbody>').append(tpl).find('tr').first();
            $row.find('[name="employees[' + idx + '].FullName"]').val('');
            $row.find('[name="employees[' + idx + '].DepartmentId"]').val('');
            $row.find('[name="employees[' + idx + '].Skill"]').val('');
            $('#employees-body').append($row);
            reindexRows();
            $('#employees-body tr').last().find('[name$=".FullName"]').focus();

            // Listen for changes to persist new row when all fields are filled
            $row.on('change blur', 'input, select', function () {
                const fullName = $row.find('[name$=".FullName"]').val();
                const dept = $row.find('[name$=".DepartmentId"]').val();
                const skill = $row.find('[name$=".Skill"]').val();
                if (!fullName || !String(fullName).trim()) return;
                if (!dept || !String(dept).trim()) return;
                if (!skill || !String(skill).trim()) return;
                // Only persist if not already saved
                if ($row.data('persisted')) return;
                var afToken = $('input[name="__RequestVerificationToken"]').val();
                var payload = { FullName: String(fullName).trim(), DepartmentId: parseInt(dept), Skill: String(skill).trim() };
                $.ajax({
                    url: '/Employees/Add',
                    method: 'POST',
                    contentType: 'application/json; charset=utf-8',
                    headers: { 'RequestVerificationToken': afToken },
                    data: JSON.stringify(payload),
                    success: function (resp) {
                        if (resp && resp.success && resp.employee) {
                            // Fetch the rendered read-only row from the server
                            $.get('/Employees/RowPartial', { id: resp.employee.Id }, function(html) {
                                $row.replaceWith(html);
                                reindexRows();
                                refreshAllSkills();
                            });
                        } else if (resp && resp.errors) {
                            // Show validation errors inline
                            var errors = resp.errors;
                            $row.find('.invalid-feedback').remove();
                            if (Array.isArray(errors)) {
                                errors.forEach(function(msg) {
                                    $row.find('td').last().append('<div class="invalid-feedback d-block">' + msg + '</div>');
                                });
                            }
                        } else if (resp && resp.message) {
                            alert('Add failed: ' + resp.message);
                        }
                    },
                    error: function (xhr) {
                        try { var json = xhr && xhr.responseJSON; if (json && json.message) alert('Add failed: ' + json.message); else if (json && json.errors) alert('Add failed: ' + (json.errors || []).join('\n')); else alert('Failed to add'); } catch (e) { alert('Failed to add'); }
                    }
                });
            });
        });

        // When modal is shown, hide the underlying table to avoid native selects from the table
        // rendering above or interfering with the modal UI in some browsers.
        $('#addEmployeeModal').on('show.bs.modal', function () {
            $('#employees-body').closest('.table-responsive').css('visibility', 'hidden');
        });
        $('#addEmployeeModal').on('hidden.bs.modal', function () {
            $('#employees-body').closest('.table-responsive').css('visibility', 'visible');
        });

        // (old edit handler removed) the delegated edit handler below handles modal-based editing of persisted rows

        // Initialize typeahead for skill inputs
        bindSkillAutocomplete();

        // If jQuery UI Autocomplete is available, initialize it as a richer autocomplete control.
        // This will act as the primary autocomplete; our custom typeahead remains as fallback.
        $(document).on('focus', '.skill', function () {
            var $input = $(this);
            if ($.ui && $.ui.autocomplete && !$input.data('ui-autocomplete')) {
                $input.autocomplete({
                    source: function (request, response) {
                        $.get('/Employees/GetSkills', { q: request.term }).done(function (data) {
                            response(data || []);
                        }).fail(function () { response([]); });
                    },
                    minLength: 0,
                    delay: 150,
                    select: function (event, ui) {
                        $input.val(ui.item.value).trigger('input');
                        return false;
                    }
                }).on('keydown', function (e) {
                    // allow Enter to select suggestion
                    if (e.key === 'Enter') { e.stopPropagation(); }
                });
            }
        });

        // Editing is done via modal. Remove auto-save behavior and instead handle modal submit
        // Restore modal-based Add/Edit: open modal for add or edit, submit via AJAX to Add/Update endpoints
        // Restore inline add-row: clicking '+ Add Employee' inserts a new editable row at the bottom
        var nextIndex = $('#employees-body tr').length;
        $('#add-employee').off('click').on('click', function (e) {
            e.preventDefault();
            var idx = nextIndex++;
            var tpl = $('#new-row-template').html();
            tpl = tpl.replace(/__INDEX__/g, idx);
            var $row = $('<tbody>').append(tpl).find('tr').first();
            $row.find('[name="employees[' + idx + '].FullName"]').val('');
            $row.find('[name="employees[' + idx + '].DepartmentId"]').val('');
            $row.find('[name="employees[' + idx + '].Skill"]').val('');
            $('#employees-body').append($row);
            reindexRows();
            $('#employees-body tr').last().find('[name$=".FullName"]').focus();

            // Listen for changes to persist new row when all fields are filled
            $row.on('change blur', 'input, select', function () {
                var fullName = $row.find('[name$=".FullName"]').val();
                var dept = $row.find('[name$=".DepartmentId"]').val();
                var skill = $row.find('[name$=".Skill"]').val();
                if (!fullName || !String(fullName).trim()) return;
                if (!dept || !String(dept).trim()) return;
                if (!skill || !String(skill).trim()) return;
                // Only persist if not already saved
                if ($row.data('persisted')) return;
                var afToken = $('input[name="__RequestVerificationToken"]').val();
                var payload = { FullName: String(fullName).trim(), DepartmentId: parseInt(dept), Skill: String(skill).trim() };
                $.ajax({
                    url: '/Employees/Add',
                    method: 'POST',
                    contentType: 'application/json; charset=utf-8',
                    headers: { 'RequestVerificationToken': afToken },
                    data: JSON.stringify(payload),
                    success: function (resp) {
                        if (resp && resp.success && resp.employee) {
                            // update row to read-only and set id
                            $row.find('input[type="hidden"][name$=".Id"]').val(resp.employee.Id);
                            $row.find('[name$=".FullName"]').prop('readonly', true);
                            $row.find('[name$=".DepartmentId"]').prop('disabled', true);
                            $row.find('[name$=".Skill"]').prop('readonly', true);
                            $row.find('.edit-btn, .delete-btn').attr('data-id', resp.employee.Id);
                            $row.data('persisted', true);
                            refreshAllSkills();
                        } else if (resp && resp.message) {
                            alert('Add failed: ' + resp.message);
                        }
                    },
                    error: function (xhr) {
                        try { var json = xhr && xhr.responseJSON; if (json && json.message) alert('Add failed: ' + json.message); else if (json && json.errors) alert('Add failed: ' + (json.errors || []).join('\n')); else alert('Failed to add'); } catch (e) { alert('Failed to add'); }
                    }
                });
            });
        });

        // Edit button: open modal and populate fields from the row
        $(document).off('click', '.edit-btn').on('click', '.edit-btn', function (e) {
            e.preventDefault();
            var id = parseInt($(this).attr('data-id') || '0');
            if (!id) return;
            var $row = $(this).closest('tr[data-employee-row]');
            var fullName = $row.find('.fullName').text().trim();
            var deptName = $row.find('.departmentName').text().trim();
            var skill = $row.find('.skillValue').text().trim();
            // find dept id from name
            var deptId = $('#modalDepartment option').filter(function () { return $(this).text().trim() === deptName; }).val() || '';
            $('#modalFullName').val(fullName).removeClass('is-invalid');
            $('#modalDepartment').val(deptId);
            $('#modalSkill').val(skill).removeClass('is-invalid');
            $('#addEmployeeModal').data('editingId', id);
            var modal = new bootstrap.Modal(document.getElementById('addEmployeeModal'));
            modal.show();
        });

        // Modal submit now performs Update via AJAX (modal is only used for editing persisted rows)
        $('#addEmployeeForm').off('submit').on('submit', function (e) {
            e.preventDefault();
            var fullName = $('#modalFullName').val();
            var dept = $('#modalDepartment').val();
            var skill = $('#modalSkill').val();
            var ok = true;
            if (!fullName || !String(fullName).trim()) { ok = false; $('#modalFullName').addClass('is-invalid'); } else { $('#modalFullName').removeClass('is-invalid'); }
            if (!dept || !String(dept).trim()) { ok = false; }
            if (!skill || !String(skill).trim()) { ok = false; $('#modalSkill').addClass('is-invalid'); } else { $('#modalSkill').removeClass('is-invalid'); }
            if (!ok) return;

            var editingId = $('#addEmployeeModal').data('editingId');
            if (!editingId) {
                // modal is used only for editing; if no editingId present, just close modal
                var modalEl = document.getElementById('addEmployeeModal');
                var modalInstance = bootstrap.Modal.getInstance(modalEl);
                if (modalInstance) modalInstance.hide();
                return;
            }

            var payload = { Id: editingId, FullName: String(fullName).trim(), DepartmentId: parseInt(dept), Skill: String(skill).trim() };
            var afToken = $('input[name="__RequestVerificationToken"]').val();
            $.ajax({
                url: '/Employees/Update',
                method: 'POST',
                contentType: 'application/json; charset=utf-8',
                headers: { 'RequestVerificationToken': afToken },
                data: JSON.stringify(payload),
                success: function (resp) {
                    if (resp && resp.success && resp.employee) {
                        // update existing row
                        var $row = $('#employees-body').find('.edit-btn[data-id="' + editingId + '"]').closest('tr');
                        $row.find('input[type="hidden"][name$=".FullName"]').val(resp.employee.FullName);
                        $row.find('.fullName').text(resp.employee.FullName);
                        var deptName = $('#modalDepartment option:selected').text();
                        $row.find('input[type="hidden"][name$=".DepartmentId"]').val(resp.employee.DepartmentId);
                        $row.find('.departmentName').text(deptName);
                        $row.find('input[type="hidden"][name$=".Skill"]').val(resp.employee.Skill);
                        $row.find('.skillValue').text(resp.employee.Skill);
                        refreshAllSkills();
                        var modalEl = document.getElementById('addEmployeeModal');
                        var modalInstance = bootstrap.Modal.getInstance(modalEl);
                        if (modalInstance) modalInstance.hide();
                    } else if (resp && resp.message) {
                        alert('Save failed: ' + resp.message);
                    }
                },
                error: function (xhr) { try { var json = xhr && xhr.responseJSON; if (json && json.message) alert('Save failed: ' + json.message); else if (json && json.errors) alert('Save failed: ' + (json.errors || []).join('\n')); else alert('Failed to save'); } catch (e) { alert('Failed to save'); } }
            });
        });

        // Ensure skill is non-empty before submit (allow new skills)
        $('form').on('submit', function (e) {
            var $form = $(this);
            e.preventDefault();
            // Remove any previous success message
            $('.alert-success').remove();
            // Make sure allowedSkills is fresh then validate
            refreshAllSkills().done(function () {
                var ok = true;
                var allowed = (window.allowedSkills || []).map(function(s) { return String(s).toLowerCase(); });
                $('.skill').each(function () {
                    var v = $(this).val();
                    if (!v || !String(v).trim() || allowed.indexOf(String(v).toLowerCase()) === -1) {
                        ok = false;
                        $(this).addClass('is-invalid');
                    } else {
                        $(this).removeClass('is-invalid');
                    }
                });
                if (!ok) {
                    // Show inline error for each invalid skill field
                    $('.skill').each(function () {
                        var v = $(this).val();
                        if (!v || !String(v).trim() || allowed.indexOf(String(v).toLowerCase()) === -1) {
                            $(this).addClass('is-invalid');
                            if ($(this).next('.invalid-feedback').length === 0) {
                                $(this).after('<div class="invalid-feedback d-block">Please select an existing skill from suggestions.</div>');
                            }
                        } else {
                            $(this).removeClass('is-invalid');
                            $(this).next('.invalid-feedback').remove();
                        }
                    });
                    return;
                }
                // all good — submit the form via AJAX
                var formData = $form.serialize();
                $.ajax({
                    url: $form.attr('action'),
                    method: $form.attr('method'),
                    data: formData,
                    success: function (resp) {
                        // If response contains the table, replace it
                        var $newTable = $(resp).find('#employees-body');
                        if ($newTable.length) {
                            $('#employees-body').replaceWith($newTable);
                        }
                        // Show JS success message and refresh page
                        var successMsg = 'Employees saved successfully.';
                        var $alert = $('<div class="alert alert-success alert-dismissible fade show" role="alert">' + successMsg + '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button></div>');
                        $form.prepend($alert);
                        setTimeout(function () { location.reload(); }, 1200);
                    },
                    error: function () {
                        alert('Failed to save employees.');
                    }
                });
            }).fail(function () {
                alert('Could not validate skills at this time. Please try again.');
            });
        });
    });

    (function () {
        window.EmployeeManager = window.EmployeeManager || {};

        // Delegate to the main reindexRows implementation so there's a single source of truth
        window.EmployeeManager.reindexRows = function () {
            if (typeof reindexRows === 'function') {
                reindexRows();
            }
        };

        $(function () {
            console.log('employees.js loaded');
            window.EmployeeManager.reindexRows();
        });
    })();
