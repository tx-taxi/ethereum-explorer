import * as yup from 'yup';

export const protocols = [ 'http', 'https' ];

export const urlTest: yup.TestConfig = {
  name: 'url',
  test: (value: unknown) => {
    if (!value) {
      return true;
    }

    try {
      if (typeof value === 'string') {
        new URL(value);
        return true;
      }
    } catch (error) {}

    return false;
  },
  message: '${path} is not a valid URL',
  exclusive: true,
};

export const urlOrRootRelativePathTest: yup.TestConfig = {
  name: 'url-or-root-relative-path',
  test: (value: unknown) => {
    if (!value) {
      return true;
    }

    if (typeof value !== 'string') {
      return false;
    }

    try {
      new URL(value);
      return true;
    } catch (error) {
      if (!value.startsWith('/') || value.startsWith('//') || /%(?:2f|5c)/i.test(value)) {
        return false;
      }

      let decodedValue = value;
      try {
        for (let index = 0; index < 5; index++) {
          const nextValue = decodeURIComponent(decodedValue);
          if (nextValue === decodedValue) {
            break;
          }
          decodedValue = nextValue;
        }
      } catch (error) {
        return false;
      }

      const pathSegments = decodedValue.split(/[?#]/, 1)[0].split('/');
      return !decodedValue.includes('\\') &&
        !/[\u0000-\u001F\u007F]/.test(decodedValue) &&
        !pathSegments.includes('.') &&
        !pathSegments.includes('..');
    }
  },
  message: '${path} is not a valid absolute URL or root-relative path',
  exclusive: true,
};

export const getYupValidationErrorMessage = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'errors' in error &&
  Array.isArray(error.errors) ?
    error.errors.join(', ') :
    '';
