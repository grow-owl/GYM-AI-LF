import { useState, useCallback } from "react";

export type ValidationRule<T> = {
  required?: boolean | string;
  email?: boolean | string;
  phone?: boolean | string;
  minLength?: { value: number; message: string };
  maxLength?: { value: number; message: string };
  matchField?: { field: keyof T; message: string };
  custom?: (value: any, formValues: T) => string | null | undefined;
};

export type ValidationSchema<T> = {
  [K in keyof T]?: ValidationRule<T>;
};

export function validateValue<T>(
  value: any,
  rules: ValidationRule<T>,
  formValues: T
): string | null {
  if (rules.required) {
    const isMissing =
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "") ||
      (Array.isArray(value) && value.length === 0);
    if (isMissing) {
      return typeof rules.required === "string"
        ? rules.required
        : "This field is required";
    }
  }

  if (!value && value !== 0) return null; // If not required and empty, skip remaining rules

  if (rules.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(value))) {
      return typeof rules.email === "string"
        ? rules.email
        : "Please enter a valid email address";
    }
  }

  if (rules.phone) {
    const phoneRegex = /^[6-9]\d{9}$/; // Standard 10-digit Indian mobile format
    const cleanPhone = String(value).replace(/[\s\-+()]/g, "");
    if (!phoneRegex.test(cleanPhone)) {
      return typeof rules.phone === "string"
        ? rules.phone
        : "Please enter a valid 10-digit mobile number";
    }
  }

  if (rules.minLength && String(value).length < rules.minLength.value) {
    return rules.minLength.message;
  }

  if (rules.maxLength && String(value).length > rules.maxLength.value) {
    return rules.maxLength.message;
  }

  if (rules.matchField) {
    const otherVal = formValues[rules.matchField.field];
    if (value !== otherVal) {
      return rules.matchField.message;
    }
  }

  if (rules.custom) {
    const customErr = rules.custom(value, formValues);
    if (customErr) return customErr;
  }

  return null;
}

export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  schema: ValidationSchema<T>
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  const validateField = useCallback(
    (field: keyof T, val: any, currentValues: T) => {
      const fieldRules = schema[field];
      if (!fieldRules) return null;
      return validateValue(val, fieldRules, currentValues);
    },
    [schema]
  );

  const handleChange = useCallback(
    (field: keyof T, value: any) => {
      setValues((prev) => {
        const next = { ...prev, [field]: value };
        if (touched[field] || errors[field]) {
          const err = validateField(field, value, next);
          setErrors((prevErr) => ({ ...prevErr, [field]: err || undefined }));
        }
        return next;
      });
    },
    [touched, errors, validateField]
  );

  const handleBlur = useCallback(
    (field: keyof T) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      const err = validateField(field, values[field], values);
      setErrors((prevErr) => ({ ...prevErr, [field]: err || undefined }));
    },
    [validateField, values]
  );

  const validateAll = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof T, string>> = {};
    let isValid = true;

    for (const key in schema) {
      const err = validateField(key, values[key], values);
      if (err) {
        newErrors[key] = err;
        isValid = false;
      }
    }

    setErrors(newErrors);
    const allTouched: Partial<Record<keyof T, boolean>> = {};
    for (const key in schema) {
      allTouched[key] = true;
    }
    setTouched(allTouched);

    return isValid;
  }, [schema, validateField, values]);

  const resetForm = useCallback(
    (newInitialValues?: T) => {
      setValues(newInitialValues || initialValues);
      setErrors({});
      setTouched({});
    },
    [initialValues]
  );

  const setFieldError = useCallback((field: keyof T, errorMsg: string) => {
    setErrors((prev) => ({ ...prev, [field]: errorMsg }));
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const setApiErrors = useCallback((apiErrors: Record<string, string>) => {
    const formattedErrors: Partial<Record<keyof T, string>> = {};
    for (const [key, msg] of Object.entries(apiErrors)) {
      formattedErrors[key as keyof T] = msg;
    }
    setErrors(formattedErrors);
  }, []);

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    validateAll,
    resetForm,
    setFieldError,
    setApiErrors,
    setValues,
    isValid: Object.values(errors).every((err) => !err),
  };
}
