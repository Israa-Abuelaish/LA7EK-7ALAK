// داخل cityController.js
const getCitiesWithCoordinates = async (req, res) => {
  try {
    const cities = await prisma.city.findMany({
      select: {
        id: true,
        name: true,
        governorate: true,
        area: true,
        latitude: true,   // خط العرض الافتراضي للمدينة
        longitude: true   // خط الطول الافتراضي للمدينة
      }
    });
    res.status(200).json(cities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getCitiesWithCoordinates };