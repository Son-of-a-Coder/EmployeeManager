$(function () {
        // Handler for Delete button (row removal and AJAX delete)
        $(document).on('click', '.delete-btn', function (e) {
            e.preventDefault();
            var $row = $(this).closest('tr');
            var idInput = $row.find('input[type="hidden"][name$=".Id"]');
            var id = idInput.val();
            if (!confirm('Are you sure you want to delete this employee?')) return;
            // If row is not yet persisted (no ID), just remove from DOM
            if (!id || id === '0') {
                $row.remove();
                reindexRows();
                return;
            }
            // Otherwise, send AJAX request to delete on server
            var afToken = $('input[name="__RequestVerificationToken"]').val();
            $.ajax({
                url: '/Employees/Delete',
                method: 'POST',
                headers: { 'RequestVerificationToken': afToken },
                data: { id: id },
                success: function (resp) {
                    if (resp && resp.success) {
                        $row.remove();
                        reindexRows();
                        alert('Employee deleted successfully.');
                    } else {
                        alert('Delete failed: ' + (resp && resp.message ? resp.message : 'Unknown error'));
                    }
                },
                error: function () {
                    alert('Failed to delete employee.');
                }
            });
        });
    // Handler for Add Employee button
    $('#add-employee').on('click', function (e) {
        e.preventDefault();
        // Find next available index (count only actual employee rows)
        var $rows = $('#employees-body tr[data-employee-row]');
        var nextIdx = $rows.length;
        // Get template HTML and replace __INDEX__ only (keep 'employees[' for model binding)
        var templateHtml = $('#new-row-template').html().replace(/__INDEX__/g, nextIdx);
        // Convert to jQuery object
        var $newRow = $(templateHtml);
        // Mark as employee row for consistency
        $newRow.attr('data-employee-row', 'true');
        // Make all inputs editable for new row
        $newRow.find('input').prop('readonly', false).prop('disabled', false).removeClass('form-control-plaintext');
        // Make department <select> enabled and required
        $newRow.find('select[name*="DepartmentId"]').prop('disabled', false).prop('required', true);
        // Ensure new row is appended inside the form
        var $form = $('#add-employee').closest('form');
        $form.find('#employees-body').append($newRow);
        // Focus first input
        $newRow.find('input,select').first().focus();
        // Reindex rows for display
        reindexRows();
    });

    // safe globals
    let allowedSkills = globalThis.allowedSkills || [];
    globalThis.allowedSkills = allowedSkills;

    // Fix: Define reindexRows function
    function reindexRows() {
        $('#employees-body tr[data-employee-row]').each(function (i) {
            $(this).find('.row-index').text(i + 1);
        });
    }

    function refreshAllSkills() {
        // Always return a promise, even if AJAX fails
        var jqXHR = $.get('/Employees/GetAllSkills')
            .done(function (data) {
                console.log('refreshAllSkills .done() called');
                globalThis.allowedSkills = allowedSkills = data || [];
            })
            .fail(function () {
                console.log('refreshAllSkills .fail() called');
                globalThis.allowedSkills = allowedSkills = globalThis.allowedSkills || [];
            });
        // If $.get fails synchronously, return a resolved promise to avoid breaking .done() chain
        if (!jqXHR || typeof jqXHR.done !== 'function') {
            return $.Deferred().resolve().promise();
        }
        return jqXHR;
    }
    refreshAllSkills();
        // Modal submit now performs Update via AJAX (modal is only used for editing persisted rows)
        $('#addEmployeeForm').off('submit').on('submit', function (e) {
            e.preventDefault();
            let fullName = $('#modalFullName').val();
            let dept = $('#modalDepartment').val();
            let skill = $('#modalSkill').val();
            let ok = true;
            if (!fullName || !String(fullName).trim()) { ok = false; $('#modalFullName').addClass('is-invalid'); } else { $('#modalFullName').removeClass('is-invalid'); }
            if (!dept || !String(dept).trim()) { ok = false; $('#modalDepartment').addClass('is-invalid'); } else { $('#modalDepartment').removeClass('is-invalid'); }
            if (!skill || !String(skill).trim()) { ok = false; $('#modalSkill').addClass('is-invalid'); } else { $('#modalSkill').removeClass('is-invalid'); }
            if (!ok) return;

            // If editingId is present, update; otherwise, add new
            let editingId = $('#addEmployeeModal').data('editingId');
            var payload = { FullName: String(fullName).trim(), DepartmentId: parseInt(dept), Skill: String(skill).trim() };
            if (editingId) {
                payload.Id = editingId;
            }
            let afToken = $('input[name="__RequestVerificationToken"]').val();
            let url = editingId ? '/Employees/Update' : '/Employees/Add';
            $.ajax({
                url: url,
                method: 'POST',
                contentType: 'application/json; charset=utf-8',
                headers: { 'RequestVerificationToken': afToken },
                data: JSON.stringify(payload),
                success: function (resp) {
                    if (resp && resp.success && resp.employee) {
                        if (editingId) {
                            // update existing row
                            var $row = $('#employees-body').find('.edit-btn[data-id="' + editingId + '"]').closest('tr');
                            $row.find('input[type="hidden"][name$=".FullName"]').val(resp.employee.FullName);
                            $row.find('.fullName').text(resp.employee.FullName);
                            var deptName = $('#modalDepartment option:selected').text();
                            $row.find('input[type="hidden"][name$=".DepartmentId"]').val(resp.employee.DepartmentId);
                            $row.find('.departmentName').text(deptName);
                            $row.find('input[type="hidden"][name$=".Skill"]').val(resp.employee.Skill);
                            $row.find('.skillValue').text(resp.employee.Skill);
                        } else {
                            // add new row to table
                            var newIdx = $('#employees-body tr').length;
                            var templateHtml = $('#new-row-template').html().replace(/__INDEX__/g, newIdx);
                            var $newRow = $(templateHtml);
                            $newRow.find('input[name*="FullName"]').val(resp.employee.FullName);
                            $newRow.find('input[name*="DepartmentId"]').val(resp.employee.DepartmentId);
                            $newRow.find('input[name*="Skill"]').val(resp.employee.Skill);
                            $newRow.find('.fullName').text(resp.employee.FullName);
                            $newRow.find('.departmentName').text($('#modalDepartment option:selected').text());
                            $newRow.find('.skillValue').text(resp.employee.Skill);
                            $newRow.find('.edit-btn').attr('data-id', resp.employee.Id);
                            $newRow.find('.delete-btn').attr('data-id', resp.employee.Id);
                            $newRow.find('input[name*="Id"]').val(resp.employee.Id);
                            $('#employees-body').append($newRow);
                        }
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
            var ok = true;
            $('#employees-body tr').each(function (i) {
                var $row = $(this);
                var $fullName = $row.find('[name="employees[' + i + '].FullName"]');
                var $dept = $row.find('[name="employees[' + i + '].DepartmentId"]');
                var $skill = $row.find('[name="employees[' + i + '].Skill"]');
                var valid = true;
                if (!$fullName.val() || !$fullName.val().trim()) {
                    valid = false;
                    $fullName.addClass('is-invalid');
                    if ($fullName.next('.invalid-feedback').length === 0) {
                        $fullName.after('<div class="invalid-feedback d-block">Full Name is required.</div>');
                    }
                } else {
                    $fullName.removeClass('is-invalid');
                    $fullName.next('.invalid-feedback').remove();
                }
                if (!$dept.val() || !$dept.val().trim()) {
                    valid = false;
                    $dept.addClass('is-invalid');
                    if ($dept.next('.invalid-feedback').length === 0) {
                        $dept.after('<div class="invalid-feedback d-block">Department is required.</div>');
                    }
                } else {
                    $dept.removeClass('is-invalid');
                    $dept.next('.invalid-feedback').remove();
                }
                if (!$skill.val() || !$skill.val().trim()) {
                    valid = false;
                    $skill.addClass('is-invalid');
                    if ($skill.next('.invalid-feedback').length === 0) {
                        $skill.after('<div class="invalid-feedback d-block">Skill is required.</div>');
                    }
                } else {
                    $skill.removeClass('is-invalid');
                    $skill.next('.invalid-feedback').remove();
                }
                if (!valid) ok = false;
            });
            if (!ok) {
                return;
            }
            // all good — submit the form via AJAX
            var formData = $form.serialize();
            console.log('Submitting form data:', formData);
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
        });
    // Modal edit handler
    $(document).off('click', '.edit-btn').on('click', '.edit-btn', function (e) {
        e.preventDefault();
        var $row = $(this).closest('tr[data-employee-row]');
        var idVal = $row.find('input[type="hidden"][name$=".Id"]').val() || $(this).attr('data-id');
        var id = idVal ? parseInt(idVal) : 0;
        if (!id || isNaN(id)) {
            alert('Employee Id not found for edit.');
            return;
        }
        var fullName = $row.find('input[name$=".FullName"]').val() || $row.find('.fullName').text().trim();
        var deptName = $row.find('input[name$=".DepartmentId"]').val() || $row.find('.departmentName').text().trim();
        var skill = $row.find('input[name$=".Skill"]').val() || $row.find('.skillValue').text().trim();
        var deptId = $row.find('input[type="hidden"][name$=".DepartmentId"]').val() || $('#modalDepartment option').filter(function () { return $(this).text().trim() === deptName; }).val() || '';
        // Populate modal fields
        $('#modalFullName').val(fullName).removeClass('is-invalid');
        $('#modalDepartment').val(deptId);
        $('#modalSkill').val(skill).removeClass('is-invalid');
        $('#addEmployeeModal').data('editingId', id);
        // Show modal
        var editModalInstance = new bootstrap.Modal(document.getElementById('addEmployeeModal'));
        editModalInstance.show();
        e.preventDefault();
        var $row = $(this).closest('tr[data-employee-row]');
        var idVal = $row.find('input[type="hidden"][name$=".Id"]').val() || $(this).attr('data-id');
        var id = idVal ? parseInt(idVal) : 0;
        if (!id || isNaN(id)) {
            alert('Employee Id not found for edit.');
            return;
        }
        var fullName = $row.find('input[name$=".FullName"]').val() || $row.find('.fullName').text().trim();
        var deptName = $row.find('input[name$=".DepartmentId"]').val() || $row.find('.departmentName').text().trim();
        var skill = $row.find('input[name$=".Skill"]').val() || $row.find('.skillValue').text().trim();
        var deptId = $row.find('input[type="hidden"][name$=".DepartmentId"]').val() || $('#modalDepartment option').filter(function () { return $(this).text().trim() === deptName; }).val() || '';
        // Populate modal fields
        $('#modalFullName').val(fullName).removeClass('is-invalid');
        $('#modalDepartment').val(deptId);
        $('#modalSkill').val(skill).removeClass('is-invalid');
        $('#addEmployeeModal').data('editingId', id);
        // Show modal
        var editModalInstance = new bootstrap.Modal(document.getElementById('addEmployeeModal'));
        editModalInstance.show();
    });

    // Modal submit handler
    $('#addEmployeeForm').off('submit').on('submit', function (e) {
        e.preventDefault();
        const fullName = $('#modalFullName').val();
        const dept = $('#modalDepartment').val();
        const skill = $('#modalSkill').val();
        let ok = true;
        if (!fullName || !String(fullName).trim()) { ok = false; $('#modalFullName').addClass('is-invalid'); } else { $('#modalFullName').removeClass('is-invalid'); }
        if (!dept || !String(dept).trim()) { ok = false; $('#modalDepartment').addClass('is-invalid'); } else { $('#modalDepartment').removeClass('is-invalid'); }
        if (!skill || !String(skill).trim()) { ok = false; $('#modalSkill').addClass('is-invalid'); } else { $('#modalSkill').removeClass('is-invalid'); }
        if (!ok) return;
        const editingId = $('#addEmployeeModal').data('editingId');
        if (!editingId || editingId === 0) {
            alert('Edit modal is for updating existing employees only.');
            const modalEl = document.getElementById('addEmployeeModal');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();
            return;
        }
        const payload = { Id: editingId, FullName: String(fullName).trim(), DepartmentId: Number.parseInt(dept), Skill: String(skill).trim() };
        const afToken = $('input[name="__RequestVerificationToken"]').val();
        $.ajax({
            url: '/Employees/Update',
            method: 'POST',
            contentType: 'application/json; charset=utf-8',
            headers: { 'RequestVerificationToken': afToken },
            data: JSON.stringify(payload),
            success: function (resp) {
                if (resp && resp.success && resp.employee) {
                    const $row = $('#employees-body').find('.edit-btn[data-id="' + editingId + '"]').closest('tr');
                    $row.find('input[type="hidden"][name$=".FullName"]').val(resp.employee.FullName);
                    $row.find('.fullName').text(resp.employee.FullName);
                    const deptName = $('#modalDepartment option:selected').text();
                    $row.find('input[type="hidden"][name$=".DepartmentId"]').val(resp.employee.DepartmentId);
                    $row.find('.departmentName').text(deptName);
                    $row.find('input[type="hidden"][name$=".Skill"]').val(resp.employee.Skill);
                    $row.find('.skillValue').text(resp.employee.Skill);
                    refreshAllSkills();
                    const modalEl = document.getElementById('addEmployeeModal');
                    const modalInstance = bootstrap.Modal.getInstance(modalEl);
                    if (modalInstance) modalInstance.hide();
                } else if (resp && resp.message) {
                    alert('Save failed: ' + resp.message);
                }
            },
            error: function (xhr) {
                try {
                    const json = xhr && xhr.responseJSON;
                    if (json?.message) alert('Save failed: ' + json.message);
                    else if (json?.errors) alert('Save failed: ' + (json.errors || []).join('\n'));
                    else alert('Failed to save');
                } catch (e) { alert('Failed to save'); }
            }
        });
    });

    // Form submit handler for validation and AJAX save
    $('form').on('submit', function (e) {
        const $form = $(this);
        e.preventDefault();
        $('.alert-success').remove();
        refreshAllSkills().done(function () {
            let ok = true;
            const allowed = (window.allowedSkills || []).map(s => String(s).toLowerCase());
            $('.skill').each(function () {
                const v = $(this).val();
                if (!v || !String(v).trim() || allowed.indexOf(String(v).toLowerCase()) === -1) {
                    ok = false;
                    $(this).addClass('is-invalid');
                } else {
                    $(this).removeClass('is-invalid');
                }
            });
            if (!ok) {
                $('.skill').each(function () {
                    const v = $(this).val();
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
            const formData = $form.serialize();
            $.ajax({
                url: $form.attr('action'),
                method: $form.attr('method'),
                data: formData,
                success: function (resp) {
                    const $newTable = $(resp).find('#employees-body');
                    if ($newTable.length) {
                        $('#employees-body').replaceWith($newTable);
                    }
                    const successMsg = 'Employees saved successfully.';
                    const $alert = $(`<div class="alert alert-success alert-dismissible fade show" role="alert">${successMsg}<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button></div>`);
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

    // Expose reindexRows for other scripts
    window.EmployeeManager = window.EmployeeManager || {};
    window.EmployeeManager.reindexRows = function () {
        if (typeof reindexRows === 'function') {
            reindexRows();
        }
    };
    // Initial log and reindex
    console.log('employees.js loaded');

    window.EmployeeManager.reindexRows();
});
