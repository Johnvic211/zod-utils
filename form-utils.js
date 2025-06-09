/**
 * Zod Form Validation Utility
 *
 * Reference: Google Doc Form Specs & Details
 * https://docs.google.com/document/d/1R4RZdp0Zg4qj-TDzLud0if8ArnYyfm-7whT_ZQg2mjE
 *
 * Please check this document for the latest form requirements and validation rules.
 */

const formUtils = {
    /**
     * Initializes and verifies the availability of Zod for form validation.
     *
     * - If Zod is not loaded, disables all `.btn-form` buttons globally.
     * - Handles dynamic content inside DataTables by re-disabling buttons on redraw.
     * - Notifies the user via a SweetAlert modal to contact the MIS department.
     *
     * @returns {object|null} Returns the Zod instance (`window.Zod.z`) if available, otherwise `null`.
     */
    initializeZod: function () {
        if (!window.Zod) {
            console.warn('Zod is not loaded. Form validation will not work.');

            // Disable all buttons with .btn-form globally
            $(".btn-form").prop('disabled', true);

            // If your .btn-form are inside the table rows,
            // this ensures newly loaded buttons are also disabled on redraw
            $('.table-datatable').on('draw.dt', function() {
                console.log('DataTable redrawn, disabling buttons');
                $(this).find(".btn-form").prop('disabled', true);
            });

            Swal.fire({
                icon: 'warning',
                title: 'Validation Not Working',
                html: '<div class="text-center">Please report this issue to the MIS department.</div>',
                confirmButtonText: 'OK',
            });

            return null;
        } else {
            return window.Zod.z;
        }
    },

    /**
     * Validates all input fields within a given container using a Zod schema.
     *
     * This function:
     * - Extracts values from all `input`, `select`, and `textarea` elements.
     * - Handles specific input types:
     *    - `checkbox`: Returns a boolean (`true` if checked).
     *    - `radio`: Returns the selected value for each group (only once per group).
     *    - `file`: Returns the first selected file or `null` if none.
     *    - `number`: Parses and returns a float.
     *    - All others: Returns the raw string value.
     * - Clears previous validation feedback before each validation run.
     * - Adds `.is-invalid` class and displays error messages next to invalid fields.
     *
     * @function validateForm
     * @param {string} containerId - The DOM ID of the form container (without `#`).
     * @param {object} schema - The Zod schema object used to validate the form data.
     * @returns {object|boolean} - Returns the parsed and validated data if successful,
     *                             otherwise returns `false` and displays error messages.
     */
    validateForm: function (containerId, schema) {
        if (!schema || typeof schema.safeParse !== 'function') {
            console.error('Zod schema is invalid or missing. Make sure Zod is imported and schema is correct.');
            return false;
        }

        const $container = $(`#${containerId}`);

        if ($container.length === 0) {
            console.error(`Container with ID "${containerId}" not found.`);
            return;
        }

        this.resetValidation(containerId);

        const formData = this.serializeForm(containerId)
        const result = schema.safeParse(formData);

        if (!result.success) {
            result.error.errors.forEach(error => {
                const fieldName = error.path[0];
                const $field = $container.find(`[name="${fieldName}"]`);
                $field.addClass('is-invalid');
                $field.after(`<div class="invalid-feedback">${error.message}</div>`);
            });
            return false;
        }

        return result.data;
    },

    /**
     * Attaches real-time validation to form fields based on a specific event using a Zod schema.
     *
     * This function listens to events like `blur`, `input`, `change`, `focusout`, `keyup`, or `keydown`
     * on `input`, `select`, and `textarea` fields within a container, and performs partial validation
     * using the provided Zod schema.
     *
     * - Automatically determines debounce delay based on the event type.
     * - Supports different input types: checkbox, radio, file, number, and standard inputs.
     * - Dynamically shows and removes validation feedback (Bootstrap `.is-invalid` and `.invalid-feedback`).
     *
     * @function setupOnEventValidation
     * @param {string} event - The DOM event to bind for validation (e.g., `blur`, `input`, `change`, etc.).
     * @param {string} containerId - The ID of the container that holds the form elements.
     * @param {object} schema - A Zod schema object used to validate individual fields.
     */
    setupOnEventValidation: function (event, containerId, schema) {
        if (!this.isValidEvent(event)) {
            console.error(`Event "${event}" is not supported for validation. Supported events: blur, input, change, focusout.`);
            return;
        }

        const delay = this.getDebounceDelay(event);
        const $container = $(`#${containerId}`);

        if ($container.length === 0) {
            console.error(`Container with ID "${containerId}" not found.`);
            return;
        }

        if (!schema || typeof schema.partial !== 'function' || typeof schema.safeParse !== 'function') {
            console.error('Zod schema is invalid or missing. Make sure Zod is imported and schema is correct.');
            return;
        }

        const partialSchema = schema.partial();

        // Adjust selector depending on event type
        let selector = 'input, select, textarea';
        if (event === 'keyup' || event === 'keydown' || event === 'input') {
            selector = 'input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea';
        }

        $container.on(event, selector, this.debounce(function () {
            const $field = $(this);
            const name = $field.attr('name');
            if (!name) return;

            const type = $field.attr('type');
            const singleFieldData = {};

            if (type === 'checkbox') {
                singleFieldData[name] = $field.is(':checked');
            } else if (type === 'radio') {
                const selected = $container.find(`input[name="${name}"]:checked`).val();
                singleFieldData[name] = selected || '';
            } else if (type === 'file') {
                singleFieldData[name] = this.files.length > 0 ? this.files[0] : null;
            } else if (type === 'number') {
                singleFieldData[name] = parseFloat($field.val());
            } else {
                singleFieldData[name] = $field.val();
            }

            const result = partialSchema.safeParse(singleFieldData);

            $field.removeClass('is-invalid');
            $field.next('.invalid-feedback').remove();

            if (!result.success) {
                const error = result.error.errors.find(e => e.path[0] === name);
                if (error) {
                    $field.addClass('is-invalid');
                    $field.after(`<div class="invalid-feedback">${error.message}</div>`);
                }
            }
        }, delay));
    },


    /**
     * Clears all validation feedback from the form container.
     * Removes `.is-invalid` classes and `.invalid-feedback` elements.
     *
     * @param {string} containerId - The ID of the form container (without `#`).
     */
    resetValidation: function(containerId) {
        const $container = $(`#${containerId}`);
        if ($container.length === 0) {
            console.error(`Container with ID "${containerId}" not found.`);
            return;
        }
        $container.find('.is-invalid').removeClass('is-invalid');
        $container.find('.invalid-feedback').remove();
    },

    /**
     * Serializes form fields into a plain object without validation.
     *
     * @param {string} containerId - The DOM ID of the form container.
     * @returns {object} An object representing the form's current input values.
     */
    serializeForm: function(containerId) {
        const $container = $(`#${containerId}`);
        if ($container.length === 0) {
            console.error(`Container with ID "${containerId}" not found.`);
            return {};
        }

        const formData = {};

        $container.find('input, select, textarea').each(function() {
            const $field = $(this);
            const name = $field.attr('name');
            if (!name) return;

            const type = $field.attr('type');

            if (type === 'checkbox') {
                formData[name] = $field.is(':checked');
            } else if (type === 'radio') {
                if (!(name in formData)) {
                    const selected = $container.find(`input[name="${name}"]:checked`).val();
                    formData[name] = selected || '';
                }
            } else if (type === 'file') {
                formData[name] = this.files.length > 0 ? this.files[0] : null;
            } else if (type === 'number') {
                formData[name] = parseFloat($field.val());
            } else {
                formData[name] = $field.val();
            }
        });

        return formData;
    },

    /**
     * Validates a single field by name inside a container using a Zod schema.
     *
     * @param {string} containerId - The ID of the container holding the field.
     * @param {string} fieldName - The name attribute of the input/select/textarea to validate.
     * @param {object} schema - A Zod schema that includes the field.
     * @returns {boolean} Returns true if valid, false otherwise.
     */
    validateField: function(containerId, fieldName, schema) {
        const $container = $(`#${containerId}`);
        if ($container.length === 0) {
            console.error(`Container with ID "${containerId}" not found.`);
            return false;
        }

        const $field = $container.find(`[name="${fieldName}"]`);
        if ($field.length === 0) {
            console.error(`Field with name "${fieldName}" not found in container.`);
            return false;
        }

        const type = $field.attr('type');
        let value;

        if (type === 'checkbox') {
            value = $field.is(':checked');
        } else if (type === 'radio') {
            const selected = $container.find(`input[name="${fieldName}"]:checked`).val();
            value = selected || '';
        } else if (type === 'file') {
            value = $field[0].files.length > 0 ? $field[0].files[0] : null;
        } else if (type === 'number') {
            value = parseFloat($field.val());
        } else {
            value = $field.val();
        }

        const partialSchema = schema.partial();
        const data = { [fieldName]: value };
        const result = partialSchema.safeParse(data);

        $field.removeClass('is-invalid');
        $field.next('.invalid-feedback').remove();

        if (!result.success) {
            const error = result.error.errors.find(e => e.path[0] === fieldName);
            if (error) {
                $field.addClass('is-invalid');
                $field.after(`<div class="invalid-feedback">${error.message}</div>`);
            }
            return false;
        }

        return true;
    },

    /**
     * Converts Zod error array into a simple key-message map.
     *
     * @param {Array} errors - Array of Zod error objects.
     * @returns {Object} Object with field names as keys and error messages as values.
     */
    formatErrorMessages: function(errors) {
        const errorMap = {};
        errors.forEach(error => {
            const key = error.path[0];
            if (!errorMap[key]) {
                errorMap[key] = error.message;
            }
        });
        return errorMap;
    },

    /**
     * Checks if the given event type is valid for attaching validation logic.
     *
     * Supported events include: 'blur', 'input', 'change', 'focusout', 'keyup', and 'keydown'.
     *
     * @function isValidEvent
     * @param {string} event - The DOM event name to validate.
     * @returns {boolean} Returns `true` if the event is supported for validation, otherwise `false`.
     */
    isValidEvent: function (event) {
        const validEvents = ['blur', 'input', 'change', 'focusout', 'keyup', 'keydown'];
        return validEvents.includes(event);
    },

    /**
     * Creates a debounced version of the given function that delays its execution.
     *
     * If `delay` is 0, the function executes immediately. Otherwise, it waits for the specified
     * delay before executing, canceling any previous invocation in the meantime.
     *
     * @function debounce
     * @param {Function} fn - The function to debounce.
     * @param {number} delay - Delay in milliseconds to wait before invoking the function.
     * @returns {Function} A debounced version of the input function.
     */
    debounce: function (fn, delay) {
        if (delay === 0) {
            return function (...args) {
                fn.apply(this, args);
            };
        }

        let timeout;

        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), delay);
        };
    },

    /**
     * Returns an appropriate debounce delay based on the provided DOM event type.
     *
     * Used to optimize validation performance depending on how frequently
     * the event is expected to fire.
     *
     * @function getDebounceDelay
     * @param {string} event - The event name (e.g., 'keyup', 'input', 'blur').
     * @returns {number} The debounce delay in milliseconds.
     */
    getDebounceDelay: function (event) {
        switch(event) {
            case 'keyup':
            case 'keydown':
                return 300;
            case 'input':
                return 250;
            case 'change':
            case 'blur':
            case 'focusout':
                return 0;
            default:
                return 0;
        }
    },

    /**
     * Displays an error message using SweetAlert2 if available, or falls back to a native alert.
     *
     * @function
     * @param {string} [message='Please fill in all required fields before submitting. Thank you!']
     *        - The message to display in the alert.
     * @returns {Promise|void}
     *          - A Promise if SweetAlert2 is used; otherwise, undefined.
     */
    showValidationErrorAlert: function (message = 'Please fill in all required fields before submitting. Thank you!') {
        if (typeof Swal !== 'undefined' && typeof Swal.fire === 'function') {
            return Swal.fire({
                title: message,
                icon: 'error',
                confirmButtonText: "OK"
            });
        } else {
            alert(message);
        }
    }
}
