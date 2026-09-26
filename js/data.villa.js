/* ==========================================================================
   THE TROPICAL HAVEN — canonical project model
   --------------------------------------------------------------------------
   Every room is defined exactly once, here.  The SVG floor plans, the 3D
   walkthrough and the room information panels are all generated from this
   object, so the drawing, the model and the written description cannot drift
   apart (readme.md section 20, "Design Consistency Rules").

   UNITS AND ORIENTATION
   Everything is in feet, in one plot-wide coordinate system:
       x  runs west -> east,  0 .. 88
       y  runs north -> south, 0 .. 99   (the north road sits along y = 0)
   A room's `rect` is [x, y, width, depth].  Areas are computed from the
   geometry rather than typed in, so a label can never contradict the plan.

   SOURCE OF TRUTH FOR THE PROGRAMME
   Floor assignment follows readme.md sections 10 and 11.  Room dimensions
   follow the schedules printed on concept sheets 3, 4 and 5 wherever the two
   agree.  Where the concept renders place the master suite, theatre and gym
   on the ground floor, the README's two-storey split wins - it is the
   approved brief (section 26).
   ========================================================================== */

(function () {
  'use strict';

  var FT = 0.3048; // feet -> metres, for the 3D model

  /* ---------------------------------------------------------------- rooms --
     kind:  room        enclosed, walls + roof
            circulation enclosed, walls + roof, shown quieter on the plan
            open        open to sky (courtyard, terraces)
            water       pools
            landscape   planting
            paving      hard landscape, driveways, decks
            structure   gazebo / pavilion (roof, no walls)
     `connects` drives both the plan's "connected spaces" links and the
     doorways cut into the 3D walls: two adjacent rooms that name each other
     get an opening, anything else stays solid.
  ---------------------------------------------------------------------- */

  var rooms = [
    /* ===================== SITE ===================== */
    {
      id: 'main-gate', name: 'Main Gate', floor: 'site', kind: 'paving',
      rect: [38, 0, 12, 2], zone: 'arrival',
      purpose: 'The single controlled entry from the north road, set on the ' +
        'centre line of the entrance foyer so the house is revealed straight ahead.',
      features: ['Centred on the foyer axis', 'Stone-clad piers', 'Warm gate lighting',
        'Screened from the parking court'],
      connects: ['front-garden', 'entry-path', 'parking'],
      images: ['elevation-front', 'elevation-dusk']
    },
    {
      id: 'entry-path', name: 'Entrance Walk', floor: 'site', kind: 'paving',
      rect: [38, 2, 12, 16], zone: 'arrival',
      purpose: 'A planted pedestrian approach that keeps the arrival ' +
        'experience separate from the car court.',
      features: ['Stone paving with planted joints', 'Low path lighting',
        'Framed view of the entrance', 'Vehicle route kept to the east'],
      connects: ['main-gate', 'front-garden', 'foyer'],
      images: ['elevation-front']
    },
    {
      id: 'front-garden', name: 'Front Garden & Lawn', floor: 'site', kind: 'landscape',
      rect: [8, 2, 30, 16], zone: 'arrival',
      purpose: 'The landscaped north face of the property - the first thing ' +
        'seen from the road, and the reason the house never reads as a wall.',
      features: ['Open lawn', 'Specimen palms', 'Flowering tropical borders',
        'Uplit trees after dark'],
      connects: ['main-gate', 'entry-path', 'garden-west'],
      images: ['aerial-view', 'elevation-front']
    },
    {
      id: 'driveway', name: 'Driveway', floor: 'site', kind: 'paving',
      rect: [50, 2, 6, 16], zone: 'arrival',
      purpose: 'Vehicle route along the east edge, deliberately kept off the ' +
        'main pedestrian axis (readme.md section 9).',
      features: ['Textured paving', 'Planted screen toward the entrance walk'],
      connects: ['main-gate', 'parking'],
      images: ['aerial-view']
    },
    {
      id: 'parking', name: '2 Car Parking', floor: 'site', kind: 'paving',
      rect: [56, 2, 20, 16], zone: 'arrival',
      purpose: 'Covered parking for two cars, pushed to the east side and ' +
        'screened so cars never dominate the entrance view.',
      features: ['Two bays', 'Planted screen wall', 'Direct service route to the kitchen',
        'Separate from the pedestrian approach'],
      connects: ['driveway', 'garden-east', 'service-lobby'],
      images: ['aerial-view', 'site-plan']
    },
    {
      id: 'garden-west', name: 'West Garden Walk', floor: 'site', kind: 'landscape',
      rect: [0, 18, 8, 58], zone: 'recreation',
      purpose: 'A shaded green buffer along the west boundary, giving the ' +
        'guest room and the master terrace an outlook into planting.',
      features: ['Dense shade planting', 'Stepping-stone walk', 'Boundary screening'],
      connects: ['front-garden', 'rear-deck', 'fruit-garden'],
      images: ['fruit-garden', 'fruit-garden-alt']
    },
    {
      id: 'garden-east', name: 'East Service Garden', floor: 'site', kind: 'landscape',
      rect: [80, 18, 8, 58], zone: 'recreation',
      purpose: 'Working green edge linking parking to the service entry, ' +
        'planted with curry leaf, herbs and citrus.',
      features: ['Curry leaf and herbs', 'Citrus', 'Service path', 'Utility screening'],
      connects: ['parking', 'service-lobby', 'fruit-garden'],
      images: ['fruit-garden-alt']
    },
    {
      id: 'rear-deck', name: 'Rear Deck & Pool Terrace', floor: 'site', kind: 'paving',
      rect: [8, 76, 72, 6], zone: 'recreation',
      purpose: 'The stone terrace the whole rear of the house opens onto - ' +
        'the hinge between the interior and the pool garden.',
      features: ['Runs the full width of the house', 'Deep roof overhang',
        'Outdoor dining setting', 'Steps down to the pool'],
      connects: ['rear-verandah', 'main-pool', 'family-living', 'dining', 'pool-gazebo'],
      images: ['pool-rear', 'outdoor-seating', 'outdoor-seating-alt']
    },
    {
      id: 'main-pool', name: 'Main Swimming Pool', floor: 'site', kind: 'water',
      rect: [16, 82, 40, 16], zone: 'recreation',
      purpose: 'The rear destination pool - private, tropical, surrounded by ' +
        'greenery and invisible from the road (readme.md section 6).',
      features: ['40 x 16 ft', 'Pool deck and loungers', 'Dense green backdrop',
        'Underwater lighting', 'No sight line from the north road'],
      connects: ['rear-deck', 'pool-gazebo', 'garden-west', 'fruit-garden'],
      images: ['pool-rear', 'pool-main']
    },
    {
      id: 'pool-gazebo', name: 'Relaxation Pavilion', floor: 'site', kind: 'structure',
      rect: [60, 82, 14, 12], zone: 'recreation',
      purpose: 'A shaded poolside pavilion for daytime lounging and evening ' +
        'gatherings, one of the several separate outdoor destinations.',
      features: ['Pitched timber roof', 'Open on all sides', 'Day bed and seating',
        'Warm downlighting'],
      connects: ['main-pool', 'rear-deck', 'fruit-garden'],
      images: ['pavilion-wide', 'pavilion', 'pavilion-alt']
    },
    {
      id: 'fruit-garden', name: 'Fruit Garden & Orchard', floor: 'site', kind: 'landscape',
      rect: [74, 82, 14, 17], zone: 'recreation',
      purpose: 'The productive garden - mango, jackfruit, guava, papaya, ' +
        'banana and citrus, with herbs at the edges (readme.md section 7).',
      features: ['Mango and jackfruit', 'Guava, papaya and banana', 'Citrus and curry leaf',
        'Herb beds', 'Explorable garden paths'],
      connects: ['main-pool', 'pool-gazebo', 'garden-east', 'well'],
      images: ['fruit-garden', 'fruit-garden-alt']
    },
    {
      id: 'well', name: 'Well', floor: 'site', kind: 'water',
      rect: [2, 86, 10, 10], zone: 'recreation',
      purpose: 'A traditional open well, treated as a landscape feature ' +
        'rather than a utility object (readme.md section 8).',
      features: ['Natural stone surround', 'Safe edge and cover', 'Planted setting',
        'Warm accent lighting', 'Seating nearby'],
      connects: ['garden-west', 'fruit-garden', 'main-pool'],
      images: ['well', 'well-alt'],
      note: 'Final position must be confirmed against groundwater, setbacks, ' +
        'drainage and the septic layout.'
    },

    /* ================== GROUND FLOOR ================== */
    {
      id: 'foyer', name: 'Entrance Foyer', floor: 'ground', kind: 'room',
      rect: [36, 18, 16, 8], zone: 'arrival', height: 12,
      /* the foyer is about the view straight through to the courtyard */
      view: 's',
      purpose: 'The arrival room. It faces the north approach and opens ' +
        'directly through to the courtyard, so the garden is the first thing seen.',
      features: ['Double-height entry', 'Straight view through to the courtyard',
        'Natural stone floor', 'Warm timber screen', 'Console and seat niche'],
      connects: ['entry-path', 'formal-living', 'powder', 'gallery-north', 'courtyard'],
      images: ['elevation-front']
    },
    {
      id: 'formal-living', name: 'Formal Living', floor: 'ground', kind: 'room',
      rect: [8, 18, 28, 16], zone: 'family', height: 12,
      purpose: 'The formal reception room, held at the north-west corner with ' +
        'a long glazed wall to the front garden.',
      features: ['28 x 16 ft', 'Full-height glazing to the garden',
        'Warm wood and natural stone', 'Seats eight comfortably',
        'Courtyard outlook to the south'],
      connects: ['foyer', 'gallery-north', 'courtyard', 'family-living'],
      images: ['living']
    },
    {
      id: 'powder', name: 'Powder Room', floor: 'ground', kind: 'room',
      rect: [52, 18, 8, 8], zone: 'family', height: 10,
      purpose: 'Guest WC placed off the entrance gallery, away from sight ' +
        'lines from the foyer.',
      features: ['Stone basin', 'Indirect lighting', 'Discreet entry'],
      connects: ['gallery-north', 'foyer'], images: []
    },
    {
      id: 'prayer', name: 'Prayer Room', floor: 'ground', kind: 'room',
      rect: [60, 18, 10, 8], zone: 'family', height: 10,
      purpose: 'A quiet dedicated room set away from the main living areas.',
      features: ['Traditional timber detail', 'Soft indirect light',
        'Quiet position off the gallery', 'Storage for ritual items'],
      connects: ['gallery-north'], images: []
    },
    {
      id: 'storage', name: 'Storage', floor: 'ground', kind: 'room',
      rect: [70, 18, 10, 8], zone: 'family', height: 10,
      purpose: 'General household storage on the service side of the plan.',
      features: ['Full-height shelving', 'Close to the service entry'],
      connects: ['gallery-north', 'service-lobby'], images: []
    },
    {
      id: 'gallery-north', name: 'Entrance Gallery', floor: 'ground', kind: 'circulation',
      rect: [36, 26, 44, 8], zone: 'family', height: 11,
      purpose: 'The east-west spine linking the foyer to the service wing, ' +
        'running along the north edge of the courtyard.',
      features: ['Courtyard glazing along its length', 'Art wall',
        'Connects every ground-floor zone', 'Daylight from the courtyard'],
      connects: ['foyer', 'formal-living', 'powder', 'prayer', 'storage',
        'verandah-east', 'main-kitchen', 'courtyard'],
      images: ['courtyard']
    },
    {
      id: 'courtyard', name: 'Central Courtyard', floor: 'ground', kind: 'open',
      rect: [29, 34, 28, 26], zone: 'family',
      purpose: 'The heart of the house - open to the sky, visible from almost ' +
        'every ground-floor room, and the source of daylight and cross ventilation.',
      features: ['28 x 26 ft, open to sky', 'Feature tree as the focal point',
        'Natural stone section', 'Lawn section', 'Dense planting bed',
        'Water feature', 'Stepping-stone path', 'Seating pocket'],
      connects: ['foyer', 'formal-living', 'gallery-north', 'verandah-west',
        'verandah-east', 'rear-verandah', 'family-living'],
      images: ['courtyard', 'courtyard-alt']
    },
    {
      id: 'verandah-west', name: 'West Verandah', floor: 'ground', kind: 'circulation',
      rect: [24, 34, 5, 26], zone: 'family', height: 11,
      purpose: 'Shaded transitional walk along the courtyard, serving the ' +
        'guest suite and the stair.',
      features: ['Open to the courtyard', 'Deep shade', 'Planted edge'],
      connects: ['courtyard', 'guest-bedroom', 'stair', 'family-living', 'gallery-north'],
      images: ['courtyard']
    },
    {
      id: 'verandah-east', name: 'East Verandah', floor: 'ground', kind: 'circulation',
      rect: [57, 34, 5, 26], zone: 'family', height: 11,
      purpose: 'The service-side walk along the courtyard, linking kitchen, ' +
        'utility and dining.',
      features: ['Open to the courtyard', 'Direct kitchen access', 'Planted edge'],
      connects: ['courtyard', 'main-kitchen', 'dirty-kitchen', 'laundry',
        'dining', 'gallery-north'],
      images: ['courtyard-alt']
    },
    {
      id: 'guest-bedroom', name: 'Guest Bedroom', floor: 'ground', kind: 'room',
      rect: [8, 34, 16, 14], zone: 'private', height: 11,
      purpose: 'The ground-floor guest room with its own bathroom, convenient ' +
        'for visitors and for anyone who cannot manage stairs.',
      features: ['16 x 14 ft', 'Attached bathroom', 'Outlook to the west garden',
        'Courtyard access via the verandah', 'Fitted wardrobe'],
      connects: ['guest-bath', 'verandah-west', 'garden-west'],
      images: ['guest-bedroom']
    },
    {
      id: 'guest-bath', name: 'Guest Bathroom', floor: 'ground', kind: 'room',
      rect: [8, 48, 8, 12], zone: 'private', height: 10,
      purpose: 'Attached bathroom serving the ground-floor guest bedroom.',
      features: ['Walk-in shower', 'Stone finishes', 'Private planted light well'],
      connects: ['guest-bedroom'], images: []
    },
    {
      id: 'stair', name: 'Main Stair', floor: 'ground', kind: 'circulation',
      rect: [16, 48, 8, 12], zone: 'family', height: 22,
      purpose: 'The single main stair, lit from the courtyard and rising to ' +
        'the first-floor landing.',
      features: ['Open timber treads', 'Double-height void', 'Courtyard daylight',
        'Feature pendant'],
      connects: ['verandah-west', 'family-living', 'landing'],
      images: []
    },
    {
      id: 'main-kitchen', name: 'Main Kitchen', floor: 'ground', kind: 'room',
      rect: [62, 34, 18, 12], zone: 'family', height: 11,
      purpose: 'The presentation kitchen, with the messy work pushed into the ' +
        'dirty kitchen behind it.',
      features: ['18 x 12 ft', 'Island with breakfast seating', 'Direct dining access',
        'Pantry and dirty kitchen behind', 'Courtyard outlook'],
      connects: ['dirty-kitchen', 'pantry', 'verandah-east', 'gallery-north', 'dining'],
      images: ['kitchen']
    },
    {
      id: 'dirty-kitchen', name: 'Dirty Kitchen', floor: 'ground', kind: 'room',
      rect: [62, 46, 10, 8], zone: 'family', height: 10,
      purpose: 'The working wet kitchen for heavy cooking, grinding and frying, ' +
        'kept out of sight of the dining room.',
      features: ['Heavy-duty cooking', 'Separate ventilation', 'Direct service access',
        'Wash-up zone'],
      connects: ['main-kitchen', 'pantry', 'laundry', 'verandah-east', 'service-lobby'],
      images: ['kitchen']
    },
    {
      id: 'pantry', name: 'Pantry', floor: 'ground', kind: 'room',
      rect: [72, 46, 8, 8], zone: 'family', height: 10,
      purpose: 'Dry goods store between the two kitchens.',
      features: ['Full-height shelving', 'Cool north-east position',
        'Opens to both kitchens'],
      connects: ['main-kitchen', 'dirty-kitchen'], images: []
    },
    {
      id: 'laundry', name: 'Laundry / Utility', floor: 'ground', kind: 'room',
      rect: [62, 54, 10, 6], zone: 'family', height: 10,
      purpose: 'Washing, drying and ironing, positioned on the service ' +
        'circulation with its own outdoor access.',
      features: ['Washer and dryer', 'Folding counter', 'Drying court access',
        'Screened from the family zone'],
      connects: ['dirty-kitchen', 'service-lobby', 'verandah-east'], images: []
    },
    {
      id: 'service-lobby', name: 'Service Entry', floor: 'ground', kind: 'circulation',
      rect: [72, 54, 8, 6], zone: 'arrival', height: 10,
      purpose: 'The secondary entrance from the parking and east garden, so ' +
        'deliveries never cross the main foyer.',
      features: ['Direct from parking', 'Boot and bag drop',
        'Keeps service traffic off the main axis'],
      connects: ['laundry', 'dirty-kitchen', 'storage', 'parking', 'garden-east'],
      images: []
    },
    {
      id: 'family-living', name: 'Family Living', floor: 'ground', kind: 'room',
      rect: [8, 60, 18, 16], zone: 'family', height: 11,
      purpose: 'The everyday living room, opening south to the rear deck and ' +
        'pool and north into the courtyard.',
      features: ['18 x 16 ft', 'Courtyard on one side, pool on the other',
        'Sliding glass to the rear deck', 'Relaxed family seating',
        'Media wall'],
      connects: ['courtyard', 'verandah-west', 'rear-verandah', 'rear-deck',
        'stair', 'formal-living'],
      images: ['living']
    },
    {
      id: 'rear-verandah', name: 'Rear Verandah', floor: 'ground', kind: 'circulation',
      rect: [26, 60, 36, 16], zone: 'recreation', height: 12,
      purpose: 'The deep shaded room between the courtyard and the pool - the ' +
        'main indoor-outdoor living space of the house.',
      features: ['36 x 16 ft under deep overhang', 'Opens fully to the pool terrace',
        'Courtyard on the north side', 'Lounge and outdoor dining',
        'Ceiling fans and timber soffit'],
      connects: ['courtyard', 'family-living', 'dining', 'rear-deck', 'main-pool'],
      images: ['outdoor-seating', 'pavilion-wide', 'pool-rear']
    },
    {
      id: 'dining', name: 'Dining Area', floor: 'ground', kind: 'room',
      rect: [62, 60, 18, 16], zone: 'family', height: 11,
      purpose: 'Seats ten, set between the kitchen above and the rear terrace, ' +
        'with the courtyard in view.',
      features: ['18 x 16 ft', 'Seats ten', 'Direct kitchen service',
        'Opens to the rear deck', 'Courtyard outlook'],
      connects: ['main-kitchen', 'verandah-east', 'rear-verandah', 'rear-deck'],
      images: ['dining']
    },

    /* =================== FIRST FLOOR =================== */
    {
      id: 'bedroom-2', name: 'Bedroom 2', floor: 'first', kind: 'room',
      rect: [8, 18, 18, 16], zone: 'private', height: 11,
      purpose: 'North-west bedroom with an attached bathroom and a long ' +
        'outlook over the front garden.',
      features: ['18 x 16 ft', 'Attached bathroom', 'Fitted wardrobe',
        'Garden outlook', 'Cross ventilation'],
      connects: ['bath-2', 'family-lounge'], images: ['guest-bedroom']
    },
    {
      id: 'bath-2', name: 'Bedroom 2 Bathroom', floor: 'first', kind: 'room',
      rect: [26, 18, 8, 16], zone: 'private', height: 10,
      purpose: 'Attached bathroom and wardrobe run for bedroom 2.',
      features: ['Walk-in shower', 'Twin basin', 'Wardrobe run'],
      connects: ['bedroom-2'], images: []
    },
    {
      id: 'family-lounge', name: 'Family Lounge', floor: 'first', kind: 'room',
      rect: [34, 18, 24, 16], zone: 'family', height: 11,
      purpose: 'The upper living room that stops the first floor becoming a ' +
        'corridor of bedrooms (readme.md section 11). It looks down into the courtyard.',
      features: ['24 x 16 ft', 'Direct courtyard overlook', 'TV and relaxed seating',
        'Opens to the gallery balcony', 'Shared family space between bedrooms'],
      connects: ['bedroom-2', 'bedroom-3', 'gallery-west', 'gallery-east', 'landing'],
      images: ['living']
    },
    {
      id: 'bath-3', name: 'Bedroom 3 Bathroom', floor: 'first', kind: 'room',
      rect: [58, 18, 8, 16], zone: 'private', height: 10,
      purpose: 'Attached bathroom and wardrobe run for bedroom 3.',
      features: ['Walk-in shower', 'Stone finishes', 'Wardrobe run'],
      connects: ['bedroom-3'], images: []
    },
    {
      id: 'bedroom-3', name: 'Bedroom 3', floor: 'first', kind: 'room',
      rect: [66, 18, 14, 16], zone: 'private', height: 11,
      purpose: 'North-east bedroom with an attached bathroom, quiet and away ' +
        'from the family lounge.',
      features: ['14 x 16 ft', 'Attached bathroom', 'Fitted wardrobe',
        'Morning light', 'Garden outlook'],
      connects: ['bath-3', 'family-lounge', 'gallery-east'], images: ['guest-bedroom']
    },
    {
      id: 'gallery-west', name: 'West Courtyard Balcony', floor: 'first', kind: 'circulation',
      rect: [24, 34, 5, 26], zone: 'family', height: 11,
      purpose: 'Open balcony gallery looking down into the courtyard, linking ' +
        'the theatre and travel room to the bedrooms.',
      features: ['Courtyard overlook', 'Timber balustrade', 'Daylight from the void'],
      connects: ['family-lounge', 'home-theatre', 'travel-room', 'landing', 'courtyard-void'],
      images: ['courtyard']
    },
    {
      id: 'courtyard-void', name: 'Courtyard Void', floor: 'first', kind: 'open',
      rect: [29, 34, 28, 26], zone: 'family',
      /* a hole through the first floor, not a surface: the 3D model must not
         lay a slab here or the courtyard stops being open to the sky */
      voidSpace: true,
      purpose: 'The courtyard rising through both floors, open to the sky. ' +
        'The first floor wraps around it as a balcony.',
      features: ['Open to sky through both storeys', 'Feature tree seen from above',
        'Daylight and ventilation for both floors'],
      connects: ['gallery-west', 'gallery-east', 'family-lounge', 'courtyard'],
      images: ['courtyard', 'courtyard-alt']
    },
    {
      id: 'gallery-east', name: 'East Courtyard Balcony', floor: 'first', kind: 'circulation',
      rect: [57, 34, 5, 26], zone: 'family', height: 11,
      purpose: 'Open balcony gallery on the east side of the void, serving ' +
        'bedroom 4, the gym and the master suite.',
      features: ['Courtyard overlook', 'Timber balustrade', 'Link to the master wing'],
      connects: ['family-lounge', 'bedroom-3', 'bedroom-4', 'gym', 'master-lounge',
        'courtyard-void'],
      images: ['courtyard-alt']
    },
    {
      id: 'home-theatre', name: 'Home Theatre', floor: 'first', kind: 'room',
      rect: [8, 34, 16, 14], zone: 'recreation', height: 11,
      purpose: 'An eight-seat cinema on the quiet west side, deliberately ' +
        'windowless for a dark, controlled room (readme.md section 12).',
      features: ['16 x 14 ft, eight seats', 'Two tiered rows',
        'Acoustic wall and ceiling treatment', 'Large screen and projector',
        'Dimmable scene lighting', 'Snack and drinks cabinet'],
      connects: ['gallery-west', 'travel-room'],
      images: ['home-theatre', 'home-theatre-alt'],
      note: 'The snack cabinet holds nuts, chocolates, drinks and small serving ' +
        'equipment without the room reading as a kitchen.'
    },
    {
      id: 'travel-room', name: 'Travel Memory Room', floor: 'first', kind: 'room',
      rect: [8, 48, 8, 12], zone: 'private', height: 11,
      purpose: 'A small, deliberately personal room for travel memories - a ' +
        'gallery, not an office (readme.md section 13).',
      features: ['8 x 12 ft, intentionally intimate', 'Bookshelf and travel books',
        'Large world map', 'Magnetic panel for fridge magnets',
        'Photo and souvenir display shelves', 'Compact writing desk',
        'Warm ambient lighting'],
      connects: ['gallery-west', 'home-theatre', 'landing'],
      images: ['travel-room-alt', 'travel-room']
    },
    {
      id: 'landing', name: 'Upper Landing', floor: 'first', kind: 'circulation',
      rect: [16, 48, 8, 12], zone: 'family', height: 11,
      purpose: 'The head of the stair, opening onto the courtyard balcony.',
      features: ['Stair void', 'Courtyard daylight', 'Links both wings'],
      connects: ['stair', 'gallery-west', 'travel-room', 'family-lounge',
        'master-terrace'],
      images: []
    },
    {
      id: 'bedroom-4', name: 'Bedroom 4', floor: 'first', kind: 'room',
      rect: [62, 34, 18, 12], zone: 'private', height: 11,
      purpose: 'East bedroom with an attached bathroom, overlooking the ' +
        'courtyard on one side and the garden on the other.',
      features: ['18 x 12 ft', 'Attached bathroom', 'Courtyard balcony access',
        'Fitted wardrobe', 'Garden outlook'],
      connects: ['bath-4', 'gallery-east'], images: ['guest-bedroom']
    },
    {
      id: 'bath-4', name: 'Bedroom 4 Bathroom', floor: 'first', kind: 'room',
      rect: [62, 46, 8, 8], zone: 'private', height: 10,
      purpose: 'Attached bathroom for bedroom 4.',
      features: ['Walk-in shower', 'Stone finishes'],
      connects: ['bedroom-4'], images: []
    },
    {
      id: 'gym', name: 'Gym / Workout Area', floor: 'first', kind: 'room',
      rect: [70, 46, 10, 14], zone: 'recreation', height: 11, view: 'n',
      purpose: 'A compact workout room on the east face, with morning light ' +
        'and a view into the garden canopy (readme.md section 14).',
      features: ['10 x 14 ft', 'Treadmill and adjustable dumbbells', 'Bench and rack',
        'Yoga and stretching mat area', 'Mirror wall', 'Natural light and green outlook',
        'Cross ventilation', 'Bathroom a few steps away'],
      connects: ['gallery-east', 'store-first', 'bath-4'],
      images: ['gym-alt', 'gym']
    },
    {
      id: 'store-first', name: 'Upper Storage', floor: 'first', kind: 'room',
      rect: [62, 54, 8, 6], zone: 'family', height: 10,
      purpose: 'Linen and household storage for the first floor.',
      features: ['Linen shelving', 'Central to the bedrooms'],
      connects: ['gallery-east', 'gym'], images: []
    },

    /* --- master suite: the private rear zone (readme.md section 4) --- */
    {
      id: 'master-terrace', name: 'Master Private Garden & Terrace', floor: 'first',
      kind: 'open', rect: [8, 60, 22, 16], zone: 'private',
      purpose: 'The master suite\'s own open-air room - a planted roof terrace ' +
        'with the plunge pool and outdoor shower, screened from the rest of the house.',
      features: ['22 x 16 ft', 'Raised planting beds and small trees',
        'Private plunge pool', 'Outdoor shower', 'Sun loungers',
        'Screened from the family terrace', 'Overlooks the pool garden'],
      connects: ['master-bedroom', 'plunge-pool', 'outdoor-shower', 'landing'],
      images: ['master-pool', 'master-suite-wide']
    },
    {
      id: 'plunge-pool', name: 'Private Plunge Pool', floor: 'first', kind: 'water',
      rect: [12, 62, 12, 8], zone: 'private',
      purpose: 'The master suite\'s private plunge pool, set into the terrace ' +
        'garden and completely private.',
      features: ['12 x 8 ft', 'Stone coping', 'Planted surround',
        'Evening pool lighting', 'Opens off the master bedroom'],
      connects: ['master-terrace', 'master-bedroom', 'outdoor-shower'],
      images: ['master-pool']
    },
    {
      id: 'outdoor-shower', name: 'Outdoor Shower', floor: 'first', kind: 'open',
      rect: [12, 70, 8, 6], zone: 'private',
      purpose: 'Open-air shower in the master garden, screened by stone and planting.',
      features: ['Stone screen wall', 'Planted enclosure', 'Rain head',
        'Direct from the plunge pool'],
      connects: ['master-terrace', 'plunge-pool', 'master-bath'],
      images: ['outdoor-shower']
    },
    {
      id: 'master-bedroom', name: 'Master Bedroom', floor: 'first', kind: 'room',
      rect: [30, 60, 20, 16], zone: 'private', height: 12,
      purpose: 'The main bedroom, set across the rear of the house so it looks ' +
        'straight down the pool garden, with its private terrace to the west.',
      features: ['20 x 16 ft', 'Full-height glazing to the pool garden',
        'Direct access to the private terrace and plunge pool',
        'Warm timber and stone', 'Seating bay', 'Deep roof overhang for shade'],
      connects: ['master-lounge', 'master-terrace', 'plunge-pool', 'master-wardrobe'],
      images: ['master-suite-wide', 'master-suite']
    },
    {
      id: 'master-lounge', name: 'Master Lounge', floor: 'first', kind: 'room',
      rect: [50, 60, 12, 16], zone: 'private', height: 11,
      purpose: 'The suite\'s private sitting room - a retreat within the ' +
        'retreat, between the bedroom and the courtyard balcony.',
      features: ['12 x 16 ft', 'Reading and coffee seating', 'Courtyard balcony access',
        'Quiet separation from the family floor'],
      connects: ['master-bedroom', 'gallery-east', 'master-wardrobe'],
      images: ['master-suite', 'master-suite-wide']
    },
    {
      id: 'master-wardrobe', name: 'Walk-in Wardrobe', floor: 'first', kind: 'room',
      rect: [62, 60, 18, 8], zone: 'private', height: 10,
      purpose: 'Full walk-in dressing room between the bedroom and bathroom.',
      features: ['18 x 8 ft', 'Island drawer unit', 'Full-height hanging',
        'Dressing mirror', 'Runs through to the bathroom'],
      connects: ['master-bedroom', 'master-lounge', 'master-bath'], images: []
    },
    {
      id: 'master-bath', name: 'Master Bathroom', floor: 'first', kind: 'room',
      rect: [62, 68, 18, 8], zone: 'private', height: 10,
      purpose: 'The luxury bathroom, with a freestanding tub set against a ' +
        'private planted screen.',
      features: ['18 x 8 ft', 'Freestanding tub', 'Twin stone basins',
        'Walk-in rain shower', 'Private planted outlook',
        'Connects to the outdoor shower'],
      connects: ['master-wardrobe', 'outdoor-shower'], images: []
    }
  ];

  /* --------------------------------------------------------------- zones --
     readme.md section 16: the property reads as a gradient from public to
     private.  Used for the plan's zone overlay and the site diagram.
  ---------------------------------------------------------------------- */
  var zones = [
    { id: 'arrival', name: 'Zone 1 — Arrival', color: '#c9a227',
      blurb: 'Gate, front landscape, entrance and foyer. The public face.' },
    { id: 'family', name: 'Zone 2 — Family', color: '#4f8a5b',
      blurb: 'Living, dining, kitchen and the courtyard. The shared heart.' },
    { id: 'recreation', name: 'Zone 3 — Recreation', color: '#3e8fa3',
      blurb: 'Pool, outdoor lounge, garden and entertainment.' },
    { id: 'private', name: 'Zone 4 — Private', color: '#8a5a7a',
      blurb: 'Bedrooms, master suite, private pool and private garden.' }
  ];

  /* ------------------------------------------------------------ materials --
     readme.md section 21.
  ---------------------------------------------------------------------- */
  var materials = {
    exterior: [
      { name: 'Natural stone', hex: '#9c9086' },
      { name: 'Warm wood', hex: '#8a5a33' },
      { name: 'Off-white render', hex: '#efece4' },
      { name: 'Large glass', hex: '#a8c4cc' },
      { name: 'Dark metal', hex: '#3a3a38' },
      { name: 'Natural concrete', hex: '#b6b2a9' },
      { name: 'Terracotta accent', hex: '#a8563a' }
    ],
    interior: [
      { name: 'Warm wood', hex: '#9a6638' },
      { name: 'Natural stone', hex: '#b3aaa0' },
      { name: 'Neutral flooring', hex: '#d8d2c6' },
      { name: 'Textured fabric', hex: '#c2b8a6' },
      { name: 'Indoor greenery', hex: '#4a7c4e' },
      { name: 'Warm indirect light', hex: '#e8c48a' }
    ]
  };

  /* --------------------------------------------------------------- routes --
     readme.md section 15.  Each route is an ordered list of room ids; the
     walkthrough and the guided tour both follow these.
  ---------------------------------------------------------------------- */
  var routes = [
    {
      id: 'arrival', name: 'The Arrival Sequence', primary: true,
      blurb: 'North road, through the landscaped entrance and foyer, into the ' +
        'courtyard, out through the living spaces to the rear garden and pool.',
      steps: ['main-gate', 'entry-path', 'foyer', 'courtyard', 'rear-verandah',
        'family-living', 'rear-deck', 'main-pool']
    },
    {
      id: 'master', name: 'The Master Retreat',
      blurb: 'From the landing into the master suite and out to its private ' +
        'garden and plunge pool.',
      steps: ['landing', 'master-lounge', 'master-bedroom', 'master-terrace',
        'plunge-pool']
    },
    {
      id: 'service', name: 'The Service Route',
      blurb: 'How the kitchen works: main kitchen, dirty kitchen, utility and ' +
        'out to the service entry.',
      steps: ['main-kitchen', 'dirty-kitchen', 'laundry', 'service-lobby', 'parking']
    },
    {
      id: 'recreation', name: 'The Recreation Floor',
      blurb: 'Theatre, gym and travel room - the upper entertainment level.',
      steps: ['landing', 'home-theatre', 'travel-room', 'family-lounge', 'gym']
    },
    {
      id: 'garden', name: 'The Garden Walk',
      blurb: 'Around the property: pool, pavilion, fruit garden and the well.',
      steps: ['main-pool', 'pool-gazebo', 'fruit-garden', 'well', 'garden-west']
    }
  ];

  /* ------------------------------------------------------------- sections --
     readme.md section 17: the site's navigation spine.
  ---------------------------------------------------------------------- */
  var sections = [
    { id: 'home', label: 'Home', icon: 'home', kind: 'home',
      blurb: 'A home where nature becomes a part of your life.' },
    { id: 'site', label: 'Site Plan', icon: 'map', kind: 'siteplan',
      blurb: 'The whole property: how house, courtyard, pool, gardens, ' +
        'parking and well sit on roughly 20 cents of north-facing land.',
      images: ['site-plan', 'aerial-view'] },
    { id: 'ground', label: 'Ground Floor', icon: 'plan', kind: 'plan', floor: 'ground',
      blurb: 'Living, dining, kitchens, the guest suite and the courtyard.',
      images: ['ground-plan-render', 'ground-plan-alt'] },
    { id: 'first', label: 'First Floor', icon: 'plan', kind: 'plan', floor: 'first',
      blurb: 'Bedrooms, the master suite, family lounge, theatre, gym and ' +
        'travel room.',
      images: ['first-plan-render'] },
    { id: 'courtyard', label: 'Courtyard', icon: 'tree', kind: 'rooms',
      rooms: ['courtyard', 'courtyard-void', 'verandah-west', 'verandah-east'],
      blurb: 'The open-to-sky heart of the house.' },
    { id: 'living', label: 'Living & Dining', icon: 'sofa', kind: 'rooms',
      rooms: ['formal-living', 'family-living', 'dining', 'family-lounge', 'foyer'],
      blurb: 'The shared rooms, all of them looking into green.' },
    { id: 'kitchen', label: 'Kitchen', icon: 'kitchen', kind: 'rooms',
      rooms: ['main-kitchen', 'dirty-kitchen', 'pantry', 'laundry', 'service-lobby'],
      blurb: 'A presentation kitchen with the real work behind it.' },
    { id: 'bedrooms', label: 'Bedrooms', icon: 'bed', kind: 'rooms',
      rooms: ['guest-bedroom', 'bedroom-2', 'bedroom-3', 'bedroom-4', 'master-bedroom'],
      blurb: 'Five bedrooms, every one with its own bathroom.' },
    { id: 'master', label: 'Master Suite', icon: 'star', kind: 'rooms',
      rooms: ['master-bedroom', 'master-lounge', 'master-wardrobe', 'master-bath',
        'master-terrace', 'plunge-pool', 'outdoor-shower'],
      blurb: 'A private resort within the house.' },
    { id: 'theatre', label: 'Home Theatre', icon: 'film', kind: 'rooms',
      rooms: ['home-theatre'], blurb: 'Eight seats, fully treated, properly dark.' },
    { id: 'gym', label: 'Gym', icon: 'dumbbell', kind: 'rooms',
      rooms: ['gym'], blurb: 'Compact, daylit, looking into the garden canopy.' },
    { id: 'travel', label: 'Travel Room', icon: 'globe', kind: 'rooms',
      rooms: ['travel-room'], blurb: 'A small room for a collected life.' },
    { id: 'pool', label: 'Pool', icon: 'wave', kind: 'rooms',
      rooms: ['main-pool', 'rear-deck', 'pool-gazebo', 'plunge-pool'],
      blurb: 'The rear pool garden, and the master\'s own plunge pool.' },
    { id: 'gardens', label: 'Gardens', icon: 'leaf', kind: 'rooms',
      rooms: ['fruit-garden', 'front-garden', 'garden-west', 'garden-east'],
      blurb: 'Fruit trees, herbs and dense tropical planting.' },
    { id: 'outdoor', label: 'Outdoor Living', icon: 'chair', kind: 'rooms',
      rooms: ['rear-verandah', 'rear-deck', 'pool-gazebo', 'master-terrace'],
      blurb: 'Several separate destinations rather than one large patio.' },
    { id: 'well', label: 'Well', icon: 'drop', kind: 'rooms',
      rooms: ['well'], blurb: 'Traditional, functional, and treated as landscape.' },
    { id: 'exterior', label: 'Exterior', icon: 'building', kind: 'gallery',
      images: ['elevation-front', 'elevation-dusk', 'aerial-view', 'hero-title',
        'pool-rear', 'pavilion-wide'],
      blurb: 'Front and rear elevations, night views and the aerial view.' }
  ];

  /* ------------------------------------------------------- plant scatter --
     Deterministic pseudo-random planting so the 3D garden is identical on
     every load (and therefore consistent with the plan, per section 20).
  ---------------------------------------------------------------------- */
  function plantSeeds() {
    var out = [];
    var seed = 20250926;
    function rnd() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }
    var beds = [
      [0, 18, 8, 58], [80, 18, 8, 58], [74, 82, 14, 17],
      [8, 2, 30, 16], [0, 76, 16, 10], [0, 96, 88, 3],
      [56, 94, 18, 5], [76, 2, 12, 16]
    ];
    beds.forEach(function (b, bi) {
      var count = Math.max(4, Math.round(b[2] * b[3] / 90));
      for (var i = 0; i < count; i++) {
        var t = rnd();
        out.push({
          x: b[0] + rnd() * b[2],
          y: b[1] + rnd() * b[3],
          type: t > 0.72 ? 'palm' : (t > 0.4 ? 'tree' : 'shrub'),
          scale: 0.7 + rnd() * 0.7,
          bed: bi
        });
      }
    });
    return out;
  }

  /* ----------------------------------------------------------------------- */

  var plot = { w: 88, d: 99 };
  var house = { x: 8, y: 18, w: 72, d: 58 };

  function areaOf(r) { return r.rect[2] * r.rect[3]; }

  function sumArea(filter) {
    return rooms.filter(filter).reduce(function (a, r) { return a + areaOf(r); }, 0);
  }

  var builtGround = sumArea(function (r) {
    return r.floor === 'ground' && r.kind !== 'open';
  });
  var builtFirst = sumArea(function (r) {
    return r.floor === 'first' && r.kind !== 'open' && r.kind !== 'water';
  });

  window.VILLA = {
    FT: FT,
    meta: {
      title: 'The Tropical Haven',
      tagline: 'A Home Where Nature Becomes a Part of Your Life',
      subtitle: 'Luxury · Nature · Family · Forever',
      summary: 'A two-storey tropical Kerala luxury villa for an approximately ' +
        '20–25 cent north-facing plot: five ensuite bedrooms, a central ' +
        'open-to-sky courtyard, a rear swimming pool, a master suite with its ' +
        'own plunge pool and garden, a gym, an eight-seat home theatre, a ' +
        'travel-memory room, a fruit garden, an external well and parking for two cars.',
      disclaimer: 'Concept stage. All dimensions and areas are indicative and ' +
        'must be verified against the actual site survey, local building rules, ' +
        'setbacks, structural design and the final architectural drawings.'
    },
    plot: plot,
    house: house,
    floorHeight: 11,
    stats: [
      { label: 'Plot area', value: '8,712 sq ft', note: '20 cents' },
      { label: 'Ground floor', value: Math.round(builtGround).toLocaleString() + ' sq ft' },
      { label: 'First floor', value: Math.round(builtFirst).toLocaleString() + ' sq ft' },
      { label: 'Total built-up',
        value: Math.round(builtGround + builtFirst).toLocaleString() + ' sq ft' },
      { label: 'Bedrooms', value: '5', note: 'all ensuite' },
      { label: 'Floors', value: '2' },
      { label: 'Courtyard', value: '728 sq ft', note: 'open to sky' },
      { label: 'Orientation', value: 'North facing' }
    ],
    rooms: rooms,
    zones: zones,
    materials: materials,
    routes: routes,
    sections: sections,
    plants: plantSeeds(),

    /* helpers used across the app */
    byId: function (id) {
      for (var i = 0; i < rooms.length; i++) {
        if (rooms[i].id === id) return rooms[i];
      }
      return null;
    },
    onFloor: function (floor) {
      return rooms.filter(function (r) { return r.floor === floor; });
    },
    areaOf: areaOf,
    dimsOf: function (r) { return r.rect[2] + "' × " + r.rect[3] + "'"; },
    centre: function (r) {
      return [r.rect[0] + r.rect[2] / 2, r.rect[1] + r.rect[3] / 2];
    }
  };
})();
