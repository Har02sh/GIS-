from flask import Flask, render_template, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

# Initialize Flask App and SQLAlchemy
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///locations.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# --- Database Models ---
class Group(db.Model):
    """Model for the groups."""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)

class Location(db.Model):
    """Model for the locations with timestamps."""
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('group.id'), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    group = db.relationship('Group', backref=db.backref('locations', lazy=True))

# --- API Routes ---
@app.route('/')
def index():
    """Renders the main map page."""
    groups = Group.query.all()
    return render_template('index.html', groups=groups)

@app.route('/api/locations')
def get_locations():
    """API endpoint to get locations for a group within a date range."""
    group_id = request.args.get('group_id', type=int)
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')

    # Basic validation
    if not all([group_id, start_date_str, end_date_str]):
        return jsonify({"error": "Missing parameters"}), 400

    try:
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD."}), 400

    # Query the database
    locations = Location.query.filter(
        Location.group_id == group_id,
        Location.timestamp >= start_date,
        Location.timestamp <= end_date
    ).order_by(Location.timestamp).all()

    # Serialize the data
    location_data = [
        {
            'latitude': loc.latitude,
            'longitude': loc.longitude,
            'timestamp': loc.timestamp.strftime('%Y-%m-%d %H:%M:%S')
        } for loc in locations
    ]

    return jsonify(location_data)

# --- Helper Functions for Database Setup ---
def setup_database():
    """Function to create database and seed it with sample data."""
    with app.app_context():
        db.create_all()

        # Check if groups already exist
        if Group.query.count() == 0:
            print("Creating sample groups...")
            groups = [
                Group(name='Group Alpha'),
                Group(name='Group Bravo'),
                Group(name='Group Charlie'),
                Group(name='Group Delta'),
                Group(name='Group Echo')
            ]
            db.session.bulk_save_objects(groups)
            db.session.commit()

        # Check if locations already exist
        if Location.query.count() == 0:
            print("Creating sample locations...")
            locations_data = [
                # Group Alpha Path
                {'group_id': 1, 'lat': 28.6139, 'lon': 76.2090, 'time': '2025-07-15 09:00:00'},
                {'group_id': 1, 'lat': 28.6304, 'lon': 77.2177, 'time': '2025-07-15 11:30:00'},
                {'group_id': 1, 'lat': 28.5245, 'lon': 77.1855, 'time': '2025-07-16 14:00:00'},
                {'group_id': 1, 'lat': 29.5245, 'lon': 78.1855, 'time': '2025-07-17 14:00:00'},
                {'group_id': 1, 'lat': 30.5245, 'lon': 79.1855, 'time': '2025-07-18 14:00:00'},
                {'group_id': 1, 'lat': 31.5245, 'lon': 80.1855, 'time': '2025-07-19 14:00:00'},
                {'group_id': 1, 'lat': 28.5245, 'lon': 77.1855, 'time': '2025-07-20 14:00:00'},
                # Group Bravo Path
                {'group_id': 2, 'lat': 28.5355, 'lon': 77.2244, 'time': '2025-07-17 10:00:00'},
                {'group_id': 2, 'lat': 28.5827, 'lon': 77.2188, 'time': '2025-07-18 12:00:00'},
                # Group Charlie Path
                {'group_id': 3, 'lat': 28.6562, 'lon': 77.2410, 'time': '2025-07-19 08:00:00'},
                {'group_id': 3, 'lat': 28.6791, 'lon': 77.2294, 'time': '2025-07-19 15:00:00'},
                 # Group Delta Path
                {'group_id': 4, 'lat': 28.7041, 'lon': 77.1025, 'time': '2025-07-20 11:00:00'},
                {'group_id': 4, 'lat': 28.6981, 'lon': 77.1105, 'time': '2025-07-20 13:00:00'},
                 # Group Echo Path
                {'group_id': 5, 'lat': 28.4595, 'lon': 77.0266, 'time': '2025-07-16 18:00:00'},
                {'group_id': 5, 'lat': 28.4715, 'lon': 77.0306, 'time': '2025-07-17 19:00:00'},
            ]
            for data in locations_data:
                location = Location(
                    group_id=data['group_id'],
                    latitude=data['lat'],
                    longitude=data['lon'],
                    timestamp=datetime.strptime(data['time'], '%Y-%m-%d %H:%M:%S')
                )
                db.session.add(location)
            db.session.commit()
            print("Database seeded.")

if __name__ == '__main__':
    setup_database()
    app.run(debug=True)