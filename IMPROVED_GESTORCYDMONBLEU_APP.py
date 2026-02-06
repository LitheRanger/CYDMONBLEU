"""
GESTORCYDMONBLEU - Versión mejorada
Gestor de cambios y devoluciones con integración de pagos y shipping

Cambios principales:
- Modelo Solicitud → ReturnRequest (estructura mejorada)
- Integración MercadoPago payments
- Integración FedEx shipping
- Historial detallado de acciones
"""

from flask import Flask, render_template, request, redirect, url_for, flash, session, abort, jsonify
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from datetime import datetime
import os
import json

# ================== CONFIG ==================
app = Flask(__name__)

app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')

app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
    'DATABASE_URL',
    'postgresql://neondb_owner:npg_O1toy9DsgBRa@ep-patient-dew-ahpacjaq-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
)

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Clave para proteger webhooks
app.config['WEBHOOK_API_KEY'] = os.environ.get('WEBHOOK_API_KEY', 'webhook-demo-key')

db = SQLAlchemy(app)

# ================== DECORADORES ==================
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'usuario_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated


def rol_required(*roles):
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            if session.get('rol') not in roles:
                flash('Acceso no autorizado', 'danger')
                return redirect(url_for('dashboard'))
            return f(*args, **kwargs)
        return wrapped
    return decorator


# ================== MODELOS MEJORADOS ==================

class Usuario(db.Model):
    """Usuarios del sistema con roles"""
    id = db.Column(db.Integer, primary_key=True)
    usuario = db.Column(db.String(50), unique=True)
    password_hash = db.Column(db.String(255))
    rol = db.Column(db.String(20))  # admin, soporte

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class ReturnRequest(db.Model):
    """Solicitudes de cambio/devolución mejoradas con integración de pagos y shipping"""
    __tablename__ = 'return_requests'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Identificadores
    request_id = db.Column(db.String(50), unique=True)
    order_id = db.Column(db.String(50), index=True)
    
    # Cliente
    contact_name = db.Column(db.String(150))
    contact_email = db.Column(db.String(150))
    contact_phone = db.Column(db.String(20))
    
    # Devolución
    return_type = db.Column(db.String(20))  # cambio, devolucion
    items_json = db.Column(db.JSON)  # [{ producto, talla_original, talla_cambio, cantidad, imagen_url }]
    files_json = db.Column(db.JSON)  # [{ filename, url, uploaded_at }]
    razon = db.Column(db.Text)  # Razón de devolución
    
    # Pago (MercadoPago)
    amount = db.Column(db.Numeric(10, 2), default=0)
    payment_status = db.Column(db.String(20), default='pending')  # pending, paid, failed
    payment_provider = db.Column(db.String(32), default='mercadopago')
    payment_reference = db.Column(db.String(150))
    
    # Envío (FedEx)
    carrier = db.Column(db.String(50))  # FEDEX, UPS, etc.
    tracking_number = db.Column(db.String(50))
    label_base64 = db.Column(db.LongText)  # PDF en base64
    label_mime = db.Column(db.String(50))  # application/pdf
    label_created_at = db.Column(db.DateTime)
    
    # Workflow
    estado = db.Column(db.String(20), default='pendiente')  # pendiente, aprobado, rechazado
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """Serializar a diccionario"""
        return {
            'id': self.id,
            'request_id': self.request_id,
            'order_id': self.order_id,
            'contact_name': self.contact_name,
            'contact_email': self.contact_email,
            'contact_phone': self.contact_phone,
            'return_type': self.return_type,
            'items': self.items_json or [],
            'razon': self.razon,
            'amount': float(self.amount) if self.amount else 0,
            'payment_status': self.payment_status,
            'payment_provider': self.payment_provider,
            'payment_reference': self.payment_reference,
            'carrier': self.carrier,
            'tracking_number': self.tracking_number,
            'label_created_at': self.label_created_at.isoformat() if self.label_created_at else None,
            'estado': self.estado,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }


class ReturnRequestHistorial(db.Model):
    """Historial de acciones en solicitudes"""
    __tablename__ = 'return_request_historial'
    
    id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.Integer, db.ForeignKey('return_requests.id'))
    accion = db.Column(db.String(50))  # aprobado, rechazado, pago_recibido, guia_generada
    usuario = db.Column(db.String(50))
    nota = db.Column(db.Text)
    metadata = db.Column(db.JSON)  # datos adicionales (ej: tracking_number, label_url)
    fecha = db.Column(db.DateTime, default=datetime.utcnow, index=True)


# ================== RUTAS: LOGIN ==================

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        u = Usuario.query.filter_by(usuario=request.form['usuario']).first()
        if u and u.check_password(request.form['password']):
            session['usuario_id'] = u.id
            session['usuario'] = u.usuario
            session['rol'] = u.rol
            return redirect(url_for('dashboard'))
        flash('Credenciales incorrectas', 'danger')
    return render_template('login.html')


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


# ================== RUTAS: DASHBOARD ==================

@app.route('/')
@login_required
def dashboard():
    """Kanban de solicitudes por estado"""
    pendientes = ReturnRequest.query.filter_by(estado='pendiente').order_by(ReturnRequest.created_at.desc()).all()
    aprobadas = ReturnRequest.query.filter_by(estado='aprobado').order_by(ReturnRequest.created_at.desc()).all()
    rechazadas = ReturnRequest.query.filter_by(estado='rechazado').order_by(ReturnRequest.created_at.desc()).all()

    return render_template(
        'dashboard.html',
        pendientes=pendientes,
        aprobadas=aprobadas,
        rechazadas=rechazadas
    )


@app.route('/return-request/<int:id>')
@login_required
def detalle_solicitud(id):
    """Detalle de una solicitud"""
    r = ReturnRequest.query.get_or_404(id)
    historial = ReturnRequestHistorial.query.filter_by(request_id=id).order_by(
        ReturnRequestHistorial.fecha.desc()
    ).all()
    return render_template('detalle_solicitud.html', solicitud=r, historial=historial)


# ================== RUTAS: ACCIONES ==================

@app.route('/return-request/<int:id>/approve', methods=['POST'])
@login_required
@rol_required('admin', 'soporte')
def aprobar_solicitud(id):
    s = ReturnRequest.query.get_or_404(id)
    s.estado = 'aprobado'
    s.updated_at = datetime.utcnow()

    db.session.add(
        ReturnRequestHistorial(
            request_id=s.id,
            accion='aprobado',
            usuario=session.get('usuario'),
            nota=request.form.get('nota', 'Aprobado'),
            metadata={'monto': float(s.amount) if s.amount else 0}
        )
    )

    db.session.commit()
    flash('Solicitud aprobada', 'success')
    return redirect(url_for('detalle_solicitud', id=id))


@app.route('/return-request/<int:id>/reject', methods=['POST'])
@login_required
@rol_required('admin', 'soporte')
def rechazar_solicitud(id):
    s = ReturnRequest.query.get_or_404(id)
    s.estado = 'rechazado'
    s.updated_at = datetime.utcnow()

    db.session.add(
        ReturnRequestHistorial(
            request_id=s.id,
            accion='rechazado',
            usuario=session.get('usuario'),
            nota=request.form.get('nota', 'Rechazado'),
            metadata={}
        )
    )

    db.session.commit()
    flash('Solicitud rechazada', 'danger')
    return redirect(url_for('detalle_solicitud', id=id))


# ================== RUTAS: WEBHOOK (DESDE CYDMONBLEU) ==================

@app.route('/webhook/return-requests', methods=['POST'])
def webhook_return_requests():
    """
    Webhook que recibe solicitudes desde CYDMONBLEU (Node.js app)
    
    Payload esperado:
    {
        "request_id": "REQ-12345",
        "order_id": "#1001",
        "cliente": {
            "nombre": "Juan",
            "email": "juan@example.com",
            "phone": "+34600000000"
        },
        "tipo": "cambio" | "devolucion",
        "items": [...],
        "razon": "No me gusta el color",
        "amount": 150.00,
        "payment_status": "pending" | "paid",
        "payment_provider": "mercadopago",
        "payment_reference": "mp_12345",
        "carrier": "FEDEX",
        "tracking_number": "7684294823",
        "label_base64": "JVBERi0xLjQK...",
        "label_mime": "application/pdf"
    }
    """
    
    # 🔐 Verificar API key
    if request.headers.get('X-API-KEY') != app.config['WEBHOOK_API_KEY']:
        return {'error': 'Unauthorized'}, 403

    data = request.json
    
    try:
        # Crear o actualizar solicitud
        r = ReturnRequest.query.filter_by(request_id=data.get('request_id')).first()
        
        if not r:
            r = ReturnRequest(
                request_id=data.get('request_id'),
                order_id=data.get('order_id')
            )
        
        # Actualizar campos
        r.contact_name = data.get('cliente', {}).get('nombre')
        r.contact_email = data.get('cliente', {}).get('email')
        r.contact_phone = data.get('cliente', {}).get('phone')
        r.return_type = data.get('tipo', 'devolucion')
        r.items_json = data.get('items')
        r.files_json = data.get('files')
        r.razon = data.get('razon')
        r.amount = data.get('amount', 0)
        r.payment_status = data.get('payment_status', 'pending')
        r.payment_provider = data.get('payment_provider', 'mercadopago')
        r.payment_reference = data.get('payment_reference')
        r.carrier = data.get('carrier')
        r.tracking_number = data.get('tracking_number')
        r.label_base64 = data.get('label_base64')
        r.label_mime = data.get('label_mime', 'application/pdf')
        
        if data.get('label_base64') and data.get('tracking_number'):
            r.label_created_at = datetime.utcnow()
        
        if data.get('payment_status') == 'paid':
            r.estado = 'pendiente'  # Estado inicial pendiente de revisión
        
        db.session.add(r)
        db.session.flush()
        
        # Registrar en historial
        accion = 'pago_recibido' if data.get('payment_status') == 'paid' else 'solicitud_creada'
        if data.get('tracking_number'):
            accion = 'guia_generada'
        
        db.session.add(
            ReturnRequestHistorial(
                request_id=r.id,
                accion=accion,
                usuario='sistema',
                nota=f"Webhook desde CYDMONBLEU",
                metadata={
                    'payment_status': data.get('payment_status'),
                    'tracking_number': data.get('tracking_number')
                }
            )
        )
        
        db.session.commit()
        
        return {
            'status': 'ok',
            'request_id': r.request_id,
            'id': r.id
        }, 201
        
    except Exception as e:
        db.session.rollback()
        return {'error': str(e)}, 400


# ================== RUTAS: API ==================

@app.route('/api/return-requests', methods=['GET'])
@login_required
def api_list_requests():
    """Listar solicitudes con filtros"""
    estado = request.args.get('estado')
    payment_status = request.args.get('payment_status')
    
    query = ReturnRequest.query
    
    if estado:
        query = query.filter_by(estado=estado)
    if payment_status:
        query = query.filter_by(payment_status=payment_status)
    
    requests_list = query.order_by(ReturnRequest.created_at.desc()).all()
    
    return jsonify({
        'success': True,
        'total': len(requests_list),
        'data': [r.to_dict() for r in requests_list]
    })


@app.route('/api/return-requests/<int:id>/historial', methods=['GET'])
@login_required
def api_historial(id):
    """Obtener historial de una solicitud"""
    r = ReturnRequest.query.get_or_404(id)
    historial = ReturnRequestHistorial.query.filter_by(request_id=id).order_by(
        ReturnRequestHistorial.fecha.desc()
    ).all()
    
    return jsonify({
        'success': True,
        'request_id': r.request_id,
        'historial': [
            {
                'id': h.id,
                'accion': h.accion,
                'usuario': h.usuario,
                'nota': h.nota,
                'metadata': h.metadata,
                'fecha': h.fecha.isoformat()
            }
            for h in historial
        ]
    })


# ================== RUTAS: INICIALIZACIÓN ==================

@app.route('/init-db')
def init_db():
    """Crear tablas"""
    try:
        db.create_all()
        return 'Base de datos creada ✅'
    except Exception as e:
        return f'Error: {str(e)}', 400


@app.route('/crear-usuarios')
def crear_usuarios():
    """Crear usuarios de demo"""
    if Usuario.query.first():
        return 'Usuarios ya existen'

    for u, r in [('admin', 'admin'), ('soporte', 'soporte')]:
        user = Usuario(usuario=u, rol=r)
        user.set_password('1234')
        db.session.add(user)

    db.session.commit()
    return 'Usuarios creados: admin/1234, soporte/1234'


# ================== RUN ==================
if __name__ == '__main__':
    app.run(debug=True)
