$(function () {
    // safe globals
    var allowedSkills = window.allowedSkills || [];
    window.allowedSkills = allowedSkills;

    function refreshAllSkills() {
        // return the jqXHR so callers can wait for completion
        return $.get('/Employees/GetAllSkills').done(function (data) {
            window.allowedSkills = allowedSkills = data || [];
        }).fail(function () {
            // keep previous value if request fails
            window.allowedSkills = allowedSkills = window.allowedSkills || [];
        });
    }

    // initially load allowed skills (async)
    refreshAllSkills();

    // Typeahead implementation for `.skill` inputs (fetches suggestions from server)
    function bindSkillAutocomplete() {
        var activeRequest = null;
        var debounceTimer = null;

        function positionList($list, $input) {
            var rect = $input[0].getBoundingClientRect();
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
            if ($list) $list.hide().empty();
        }

        // handle keyboard navigation inside suggestion list
        function handleKey(e, $input, $list) {
            var $items = $list.find('.list-group-item');
            if (!$items.length) return;
            var idx = $items.index($items.filter('.active'));
            if (e.key === 'ArrowDown') {
                idx = Math.min($items.length - 1, idx + 1);
                $items.removeClass('active').eq(idx).addClass('active');
                e.preventDefault();
            } else if (e.key === 'ArrowUp') {
                idx = Math.max(0, idx - 1);
                $items.removeClass('active').eq(idx).addClass('active');
                e.preventDefault();
            } else if (e.key === 'Enter') {
                var $sel = $items.filter('.active').first();
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
            var $input = $(this);
            var $list = $input.data('typeaheadList');
            if (!$list) {
                $list = createList();
                $input.data('typeaheadList', $list);
            }
            positionList($list, $input);
        });

        $(document).on('blur', '.skill', function () {
            var $input = $(this);
            var $list = $input.data('typeaheadList');
            setTimeout(function () { hideList($list); }, 150);
        });

        $(document).on('keydown', '.skill', function (e) {
            var $input = $(this);
            var $list = $input.data('typeaheadList');
            if ($list && $list.is(':visible')) {
                handleKey(e, $input, $list);
            }
        });

        $(document).on('input', '.skill', function () {
            var $input = $(this);
            var q = String($input.val() || '').trim();
            var $list = $input.data('typeaheadList');
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
                var $input = $(this);
                var $list = $input.data('typeaheadList');
                if ($list && $list.is(':visible')) positionList($list, $input);
            });
        });
    }

        // Utility: reindex rows so model binding uses sequential indexes
        function reindexRows() {
            $('#employees-body tr').each(function (i) {
                var $tr = $(this);
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
            var $btn = $(this);
            var $row = $btn.closest('tr');
            var id = parseInt($btn.attr('data-id') || '0');
            if (id > 0) {
                if (!confirm('Are you sure you want to delete this record?')) return;
                var token = $('input[name="__RequestVerificationToken"]').val();
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

        // Add new row
        var nextIndex = $('#employees-body tr').length;
        // Open modal to add a new employee instead of inserting inline
            $('#add-employee').on('click', function (e) {
            e.preventDefault();
            // clear modal inputs
            $('#modalFullName').val('').removeClass('is-invalid');
            $('#modalDepartment').val($('#employees-body tr:first select[name$=".DepartmentId"]').val() || '');
            $('#modalSkill').val('').removeClass('is-invalid');
            var modal = new bootstrap.Modal(document.getElementById('addEmployeeModal'));
            // mark modal as adding (no editing index)
            $('#addEmployeeModal').data('editingIndex', null);
            modal.show();
        });

        // When modal is shown, hide the underlying table to avoid native selects from the table
        // rendering above or interfering with the modal UI in some browsers.
        $('#addEmployeeModal').on('show.bs.modal', function () {
            $('#employees-body').closest('.table-responsive').css('visibility', 'hidden');
        });
        $('#addEmployeeModal').on('hidden.bs.modal', function () {
            $('#employees-body').closest('.table-responsive').css('visibility', 'visible');
        });

        // Handle modal submit: validate and insert new row using server template
        $('#addEmployeeForm').on('submit', function (e) {
            e.preventDefault();
            var fullName = $('#modalFullName').val();
            var dept = $('#modalDepartment').val();
            var skill = $('#modalSkill').val();
            var ok = true;
            if (!fullName || !String(fullName).trim()) {
                ok = false;
                $('#modalFullName').addClass('is-invalid');
            } else {
                $('#modalFullName').removeClass('is-invalid');
            }

                // Ensure skill is non-empty; we allow new skills (they will be persisted server-side)
                refreshAllSkills().done(function () {
                    if (!skill || !String(skill).trim()) {
                        ok = false;
                        $('#modalSkill').addClass('is-invalid');
                    } else {
                        $('#modalSkill').removeClass('is-invalid');
                    }

                    if (!ok) return;

                var editingIndex = $('#addEmployeeModal').data('editingIndex');
                    if (editingIndex !== null && editingIndex !== undefined) {
                    // update existing row
                    var $row = $('#employees-body tr').eq(editingIndex);
                    $row.find('input[type="hidden"]').val($row.find('input[type="hidden"]').val() || '0');
                    $row.find('[name$=".FullName"]').val(fullName);
                    $row.find('[name$=".DepartmentId"]').val(dept);
                    $row.find('[name$=".Skill"]').val(skill);
                    reindexRows();
                } else {
                    var idx = nextIndex++;
                    var tpl = $('#new-row-template').html();
                    tpl = tpl.replace(/__INDEX__/g, idx);
                    // parse template into a proper table row to avoid browser reparenting
                    var $row = $('<tbody>').append(tpl).find('tr').first();
                    // set values into new row inputs
                    $row.find('[name="employees[' + idx + '].FullName"]').val(fullName);
                    $row.find('[name="employees[' + idx + '].DepartmentId"]').val(dept);
                    $row.find('[name="employees[' + idx + '].Skill"]').val(skill);
                    $('#employees-body').append($row);
                    reindexRows();
                }

                // close modal
                var modalEl = document.getElementById('addEmployeeModal');
                var modalInstance = bootstrap.Modal.getInstance(modalEl);
                        if (modalInstance) modalInstance.hide();
                    }).fail(function () {
                        // treat as invalid if we couldn't refresh allowed skills
                        $('#modalSkill').addClass('is-invalid');
                    });
            });

        // Edit button handler: open modal prefilled with row data
        $(document).on('click', '.edit-btn', function (e) {
            e.preventDefault();
            var $btn = $(this);
            var $row = $btn.closest('tr');
            var idx = $row.index();
            var id = $row.find('input[type="hidden"]').val();
            var fullName = $row.find('[name$=".FullName"]').val();
            var dept = $row.find('[name$=".DepartmentId"]').val();
            var skill = $row.find('[name$=".Skill"]').val();
            $('#modalFullName').val(fullName).removeClass('is-invalid');
            $('#modalDepartment').val(dept);
            $('#modalSkill').val(skill).removeClass('is-invalid');
            // store editing index on modal
            $('#addEmployeeModal').data('editingIndex', idx);
            var modal = new bootstrap.Modal(document.getElementById('addEmployeeModal'));
            modal.show();
        });

        // Initialize typeahead for skill inputs
        bindSkillAutocomplete();

        // Ensure skill is non-empty before submit (allow new skills)
        $('form').on('submit', function (e) {
            var $form = $(this);
            e.preventDefault();
            // Make sure allowedSkills is fresh then validate
            refreshAllSkills().done(function () {
                var ok = true;
                $('.skill').each(function () {
                    var v = $(this).val();
                    if (!v || !String(v).trim()) {
                        ok = false;
                        $(this).addClass('is-invalid');
                    } else {
                        $(this).removeClass('is-invalid');
                    }
                });
                if (!ok) {
                    alert('Please enter skills; new skills will be added automatically.');
                    return;
                }
                // all good — submit the form programmatically
                $form.off('submit'); // unbind to avoid recursion
                $form.submit();
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
