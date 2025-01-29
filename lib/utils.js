const slugify = (str) => {
  return String(str)
    .normalize('NFKD') // split accented characters into their base characters and diacritical marks
    .replace(/[\u0300-\u036f]/g, '') // remove all the accents, which happen to be all in the \u03xx UNICODE block.
    .trim() // trim leading or trailing whitespace
    .toLowerCase() // convert to lowercase
    .replace(/[^a-z0-9 -]/g, '') // remove non-alphanumeric characters
    .replace(/\s+/g, '-') // replace spaces with hyphens
    .replace(/-+/g, '-'); // remove consecutive hyphens
}

const generateTransactionNumber = (val, type) => {
  // : Pen/No.xx/New atau Adendum/Bulan Pengajuan/Tahun Pengajuan
  const orderNo = `000${val}`;
  const orderNoSlice = orderNo.slice(-4);
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  const formatedOrdNo = `Pen/No.${orderNoSlice}/${type}/${month}/${year}`;
  return formatedOrdNo;
}

const generateInvoiceNumber = (val) => {
  const invNo = `00000${val}`;
  const date = new Date();
  return `INV-${date
    .getFullYear()
    .toString()
    }${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}${invNo.slice(-6)}`;
}

module.exports = {
  slugify,
  generateTransactionNumber,
  generateInvoiceNumber
};