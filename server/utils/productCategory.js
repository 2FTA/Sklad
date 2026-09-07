const PRODUCT_CATEGORY_BEER = 'beer';
const PRODUCT_CATEGORY_HOUSEHOLD = 'household';

const VALID_CATEGORIES = [PRODUCT_CATEGORY_BEER, PRODUCT_CATEGORY_HOUSEHOLD];

function parseCategoryParam(value) {
  if (value === PRODUCT_CATEGORY_HOUSEHOLD) {
    return PRODUCT_CATEGORY_HOUSEHOLD;
  }
  return PRODUCT_CATEGORY_BEER;
}

function parseCategoryBody(value) {
  return parseCategoryParam(value);
}

module.exports = {
  PRODUCT_CATEGORY_BEER,
  PRODUCT_CATEGORY_HOUSEHOLD,
  VALID_CATEGORIES,
  parseCategoryParam,
  parseCategoryBody,
};
