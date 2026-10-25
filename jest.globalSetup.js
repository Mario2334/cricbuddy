// Pin a DST-free timezone so date tests are deterministic on every machine.
module.exports = async () => {
  process.env.TZ = 'Asia/Kolkata';
};
