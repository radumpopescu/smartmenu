const photos = {
  '/images/bowl.jpg': { w: 1200, h: 1200 },
  '/images/buddha.jpg': { w: 1200, h: 799 },
  '/images/cappuccino.jpg': { w: 800, h: 1200 },
  '/images/doughnut.jpg': { w: 960, h: 1200 },
  '/images/eggtoast.jpg': { w: 1200, h: 1200 },
  '/images/flatwhite.jpg': { w: 1200, h: 671 },
  '/images/frenchtoast.jpg': { w: 928, h: 1200 },
  '/images/negroni.jpg': { w: 1200, h: 799 },
  '/images/oldfashioned.jpg': { w: 1200, h: 801 },
  '/images/pancakes.jpg': { w: 993, h: 1200 },
  '/images/pannacotta.jpg': { w: 800, h: 1200 },
  '/images/pasta.jpg': { w: 1350, h: 841 },
  '/images/pesto.jpg': { w: 1050, h: 701 },
  '/images/salad.jpg': { w: 850, h: 567 },
  '/images/soup.jpg': { w: 1200, h: 799 },
  '/images/spritz.jpg': { w: 1200, h: 875 },
  '/images/tagliata.jpg': { w: 1200, h: 794 },
  '/images/tiramisu.jpg': { w: 900, h: 1200 }
};

const dish = (name, description, price, extra = {}) => ({
  name, description, price, portion: '', tags: [], allergens: '', calories: null,
  photo: null, featured: false, available: true, ...extra
});
const section = (name, items, note = '') => ({ name, note, items });

export const samples = {
  'demo-osteria': {
    name: 'Osteria Verde', subtitle: 'Seasonal Italian cooking, made to be shared.',
    currency: 'EUR', template: 'osteria', palette: 'olive', accent: '', photos,
    sections: [
      section('Antipasti', [
        dish('Market greens', 'Seasonal leaves, shaved fennel and a bright lemon dressing.', 950, { photo: '/images/salad.jpg', tags: ['vegan', 'gluten-free'], portion: '180 g' }),
        dish('Rosemary focaccia', 'Warm from the oven, with extra virgin olive oil.', 650, { tags: ['vegan'] }),
        dish('Burrata and tomato', 'Creamy burrata, heritage tomatoes, basil oil.', 1250, { tags: ['vegetarian', 'gluten-free'], allergens: 'milk' }),
        dish('Vitello tonnato', 'Thinly sliced veal, tuna and caper sauce.', 1400, { allergens: 'fish, egg' })
      ]),
      section('Primi', [
        dish('Woodland mushroom tagliatelle', 'Fresh ribbon pasta with sautéed mushrooms, thyme and aged Parmigiano.', 1800, { photo: '/images/pasta.jpg', featured: true, tags: ['vegetarian'], portion: '320 g', calories: 640, allergens: 'gluten, egg, milk' }),
        dish('Pesto alla Genovese', 'Basil, toasted pine nuts and aged Parmesan.', 1600, { photo: '/images/pesto.jpg', tags: ['vegetarian'], portion: '300 g', allergens: 'gluten, nuts, milk' }),
        dish('Lemon and thyme risotto', 'Carnaroli rice, lemon zest and fresh thyme.', 1900, { tags: ['vegetarian', 'gluten-free'], allergens: 'milk' }),
        dish('Cacio e pepe', 'Tonnarelli, Pecorino Romano and black pepper.', 1500, { tags: ['vegetarian'], allergens: 'gluten, milk' }),
        dish('Ragù alla Bolognese', 'Slow-cooked beef and pork ragù on fresh tagliatelle.', 1750, { allergens: 'gluten, egg, celery' })
      ], 'Fresh pasta made every morning.'),
      section('Secondi', [
        dish('Sea bass al forno', 'Whole roasted sea bass, lemon, capers and parsley.', 2600, { tags: ['gluten-free'], portion: '400 g', allergens: 'fish' }),
        dish('Pollo alla diavola', 'Chargrilled chicken, chilli, garlic and rosemary.', 2100, { tags: ['spicy', 'gluten-free'] }),
        dish('Tagliata di manzo', 'Sliced sirloin, rocket and Parmigiano.', 2900, { photo: '/images/tagliata.jpg', featured: true, portion: '250 g', allergens: 'milk' }),
        dish('Melanzane alla parmigiana', 'Baked aubergine, tomato and mozzarella.', 1700, { tags: ['vegetarian'], available: false, allergens: 'milk' })
      ]),
      section('Dolci', [
        dish('Tiramisù', 'Savoiardi, espresso and mascarpone.', 800, { photo: '/images/tiramisu.jpg', tags: ['vegetarian'], allergens: 'gluten, egg, milk' }),
        dish('Panna cotta', 'Vanilla cream with a sour cherry compote.', 750, { photo: '/images/pannacotta.jpg', tags: ['gluten-free'], allergens: 'milk' }),
        dish('Affogato', 'Vanilla gelato drowned in espresso.', 600, { tags: ['vegetarian', 'gluten-free'], allergens: 'milk' })
      ])
    ]
  },

  'demo-carta': {
    name: 'La Livadă', subtitle: 'Bucătărie românească de sezon, din ingrediente de la producători locali.',
    currency: 'RON', template: 'carta', palette: 'ivory', accent: '', photos,
    sections: [
      section('Gustări', [
        dish('Zacuscă de vinete', 'Cu pâine de casă prăjită pe plită.', 2800, { tags: ['vegan'], portion: '150 g' }),
        dish('Platou țărănesc', 'Telemea, slănină afumată, ceapă roșie, roșii și castraveți murați.', 5400, { featured: true, portion: '400 g', allergens: 'lapte' }),
        dish('Salată de vinete', 'Vinete coapte pe jar, ceapă și ulei de floarea-soarelui.', 2600, { tags: ['vegan', 'gluten-free'], portion: '180 g' }),
        dish('Salată de crudități', 'Frunze proaspete, fenicul și dressing de lămâie.', 2400, { photo: '/images/salad.jpg', tags: ['vegan', 'gluten-free'], portion: '200 g' })
      ]),
      section('Ciorbe', [
        dish('Ciorbă de văcuță', 'Cu legume de grădină și leuștean.', 2900, { portion: '350 ml', allergens: 'țelină' }),
        dish('Ciorbă rădăuțeană', 'Cu pui, smântână și usturoi.', 3100, { portion: '350 ml', allergens: 'lapte, ou' }),
        dish('Supă cremă de dovleac', 'Cu semințe prăjite și ulei de dovleac.', 2700, { photo: '/images/soup.jpg', tags: ['vegetarian', 'gluten-free'], portion: '300 ml', allergens: 'lapte' })
      ], 'Servite cu ardei iute și smântână.'),
      section('Feluri principale', [
        dish('Sarmale în foi de viță', 'Cu mămăliguță, smântână și ardei iute.', 4600, { featured: true, portion: '380 g', allergens: 'lapte' }),
        dish('Tochitură moldovenească', 'Porc, cârnați, ou ochi și brânză de burduf.', 5200, { portion: '450 g', allergens: 'ou, lapte' }),
        dish('Păstrăv la grătar', 'Cu cartofi natur și unt cu verdețuri.', 5800, { tags: ['gluten-free'], portion: '350 g', allergens: 'pește, lapte' }),
        dish('Tocăniță de hribi', 'Cu mămăliguță și mărar proaspăt.', 4400, { tags: ['vegetarian', 'gluten-free'], portion: '320 g', allergens: 'lapte' }),
        dish('Pastramă de berbecuț', 'Cu mămăligă și murături de casă.', 6200, { available: false, portion: '300 g' })
      ]),
      section('Desert', [
        dish('Papanași cu smântână și dulceață', 'Doi papanași calzi, cu dulceață de afine.', 3200, { tags: ['vegetarian'], portion: '280 g', allergens: 'gluten, ou, lapte' }),
        dish('Plăcintă cu mere', 'Cu scorțișoară și înghețată de vanilie.', 2600, { tags: ['vegetarian'], allergens: 'gluten, lapte' }),
        dish('Clătite cu dulceață', 'Trei clătite cu dulceață de caise.', 2200, { tags: ['vegetarian'], allergens: 'gluten, ou, lapte' })
      ]),
      section('Vinuri la pahar', [
        dish('Fetească Neagră', 'Dealu Mare, sec.', 2800, { portion: '150 ml' }),
        dish('Fetească Regală', 'Târnave, sec.', 2400, { portion: '150 ml' }),
        dish('Tămâioasă Românească', 'Drăgășani, demidulce.', 2600, { portion: '150 ml' }),
        dish('Rosé de Busuioacă', 'Bohotin, demisec.', 2600, { portion: '150 ml' })
      ])
    ]
  },

  'demo-mercato': {
    name: 'Sunny Side', subtitle: 'All-day brunch, good coffee, no rush.',
    currency: 'EUR', template: 'mercato', palette: 'citrus', accent: '', photos,
    sections: [
      section('Bowls & plates', [
        dish('Buddha bowl', 'Chickpeas, avocado, red cabbage, tomatoes and tahini.', 1200, { photo: '/images/buddha.jpg', tags: ['vegan', 'gluten-free'], allergens: 'sesame' }),
        dish('Basil pesto linguine', 'Pine nuts, Parmesan and a lot of basil.', 1300, { photo: '/images/pesto.jpg', tags: ['vegetarian'], allergens: 'gluten, nuts, milk' }),
        dish('Mushroom tagliatelle', 'Wild mushrooms, thyme and brown butter.', 1400, { photo: '/images/pasta.jpg', tags: ['vegetarian', 'new'], allergens: 'gluten, egg, milk' }),
        dish('Green goddess bowl', 'Leaves, avocado, cucumber, seeds and a lemon herb dressing.', 1150, { photo: '/images/bowl.jpg', tags: ['vegan', 'gluten-free'], calories: 420 })
      ]),
      section('Eggs', [
        dish('Turkish eggs', 'Poached eggs, garlic yoghurt, chilli butter, sourdough.', 1100, { tags: ['vegetarian', 'spicy'], allergens: 'egg, milk, gluten' }),
        dish('Shakshuka', 'Two eggs baked in spiced tomato and peppers.', 1050, { tags: ['vegetarian', 'spicy'], allergens: 'egg' }),
        dish('Eggs Benedict', 'Ham, hollandaise, toasted brioche.', 1200, { featured: true, allergens: 'egg, milk, gluten' }),
        dish('Fried egg on sourdough', 'A runny egg, rocket and black pepper.', 900, { photo: '/images/eggtoast.jpg', tags: ['vegetarian'], allergens: 'egg, gluten' })
      ], 'Free-range eggs, served until 16:00.'),
      section('Toasts', [
        dish('Smashed avocado', 'Lime, chilli flakes, pickled onion.', 950, { tags: ['vegan'], allergens: 'gluten' }),
        dish('Ricotta and honey', 'Whipped ricotta, thyme honey, walnuts.', 900, { tags: ['vegetarian'], allergens: 'milk, nuts, gluten' }),
        dish('Banana bread', 'Toasted, with salted butter.', 550, { tags: ['vegetarian'], available: false, allergens: 'gluten, egg, milk' })
      ]),
      section('Sweet', [
        dish('Buttermilk pancakes', 'A tall stack with maple syrup and butter.', 1050, { photo: '/images/pancakes.jpg', featured: true, tags: ['vegetarian'], allergens: 'gluten, egg, milk' }),
        dish('French toast', 'Brioche, banana, blueberries and honey.', 1100, { photo: '/images/frenchtoast.jpg', tags: ['vegetarian'], allergens: 'gluten, egg, milk' }),
        dish('Glazed doughnut', 'Chocolate glaze and sprinkles.', 450, { photo: '/images/doughnut.jpg', tags: ['vegetarian', 'new'], allergens: 'gluten, egg, milk' })
      ]),
      section('Coffee', [
        dish('Espresso', '', 250),
        dish('Flat white', '', 380, { photo: '/images/flatwhite.jpg' }),
        dish('Cappuccino', '', 380, { photo: '/images/cappuccino.jpg' }),
        dish('Iced latte', 'Oat milk on request.', 420),
        dish('Matcha latte', '', 450, { tags: ['new'] })
      ]),
      section('Fresh juice', [
        dish('Orange', 'Squeezed to order.', 480, { portion: '300 ml' }),
        dish('Green', 'Apple, celery, spinach, ginger.', 550, { portion: '300 ml', allergens: 'celery' }),
        dish('Carrot and turmeric', '', 550, { portion: '300 ml' })
      ])
    ]
  },

  'demo-notte': {
    name: 'Luna', subtitle: 'Cocktails and small plates, from dusk.',
    currency: 'EUR', template: 'notte', palette: 'brass', accent: '', photos,
    sections: [
      section('Signatures', [
        dish('Luna Negroni', 'Gin, bitter, sweet vermouth, smoked orange.', 1300, { photo: '/images/negroni.jpg', featured: true }),
        dish('Velvet Hour', 'Bourbon, fig, walnut bitters, lemon.', 1400, { allergens: 'nuts' }),
        dish('Garden Gimlet', 'Gin, basil cordial, lime.', 1200, { tags: ['new'] }),
        dish('Midnight Spritz', 'Amaro, blackcurrant, prosecco.', 1200, { photo: '/images/spritz.jpg' })
      ], 'Each one stirred or shaken to order.'),
      section('Classics', [
        dish('Old Fashioned', 'Bourbon, demerara, bitters.', 1200, { photo: '/images/oldfashioned.jpg' }),
        dish('Martini', 'Gin or vodka, as dry as you like.', 1200),
        dish('Daiquiri', 'White rum, lime, sugar.', 1100),
        dish('Paloma', 'Tequila, grapefruit, lime, salt.', 1150)
      ]),
      section('Zero proof', [
        dish('Citrus Highball', 'Yuzu, tonic, rosemary.', 800),
        dish('Bitter Orange', 'Alcohol-free aperitivo, soda.', 800)
      ]),
      section('Small plates', [
        dish('Truffle tagliatelle', 'Fresh pasta, wild mushrooms, Parmigiano.', 1600, { photo: '/images/pasta.jpg', tags: ['vegetarian'], allergens: 'gluten, egg, milk' }),
        dish('Marinated olives', 'Orange peel, thyme.', 500, { tags: ['vegan', 'gluten-free'] }),
        dish('Burrata', 'Basil oil, grilled sourdough.', 1100, { tags: ['vegetarian'], allergens: 'milk, gluten' }),
        dish('Salted almonds', '', 450, { tags: ['vegan', 'gluten-free'], allergens: 'nuts' })
      ])
    ]
  }
};

samples['osteria-verde-example'] = samples['demo-osteria'];
