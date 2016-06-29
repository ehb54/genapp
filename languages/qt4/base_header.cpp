#include "__application__.h"

mQLabel::mQLabel( QWidget *parent, Qt::WindowFlags f ) : QLabel( parent, f ) 
{ 
   mbuddy       = (mQLabel*)0;
   pixmap_base  = (QPixmap*)0;
   pixmap_hover = (QPixmap*)0;
}

mQLabel::mQLabel( const QString & text, QWidget *parent, Qt::WindowFlags f ) : QLabel( text, parent, f ) 
{ 
   mbuddy       = (mQLabel*)0;
   pixmap_base  = (QPixmap*)0;
   pixmap_hover = (QPixmap*)0;
}

mQLabel::~mQLabel() {}

void mQLabel::mousePressEvent ( QMouseEvent *e )
{
   QLabel::mousePressEvent( e );
   emit( pressed() );
}

void mQLabel::enterEvent ( QEvent *e )
{
   //   setCursor( Qt::PointingHandCursor );
   if ( mbuddy )
   {
      mbuddy->setStyleSheet( "color: rgb( __select_color_rgb__ );" );
      if ( mbuddy->pixmap_hover )
      {
         mbuddy->setPixmap( *(mbuddy->pixmap_hover) );
      }
   } else {
      setStyleSheet( "color: rgb( __select_color_rgb__ );" );
   }
   if ( pixmap_hover )
   {
      setPixmap( *pixmap_hover );
   }
   QLabel::enterEvent( e );
}

void mQLabel::leaveEvent ( QEvent *e )
{
   //   unsetCursor();
   if ( mbuddy )
   {
      mbuddy->setStyleSheet( "color: rgb( __text_color_rgb__ );" );
      if ( mbuddy->pixmap_base )
      {
         mbuddy->setPixmap( *(mbuddy->pixmap_base) );
      }
   } else {
      setStyleSheet( "color: rgb( __text_color_rgb__ );" );
   }
   if ( pixmap_base )
   {
      setPixmap( *pixmap_base );
   }
   QLabel::leaveEvent( e );
}


mQPushButton::mQPushButton( QWidget *parent ) : QPushButton( parent ) { }

mQPushButton::~mQPushButton() {}

void mQPushButton::enterEvent ( QEvent *e )
{
   // setCursor( Qt::PointingHandCursor );
   //   setPalette( palette_pb_hover );
   QPushButton::enterEvent( e );
}

void mQPushButton::leaveEvent ( QEvent *e )
{
   // unsetCursor();
   //   setPalette( palette_app );
   QPushButton::leaveEvent( e );
}

mQRadioButton::mQRadioButton( QWidget *parent ) : QRadioButton( parent ) { }

mQRadioButton::~mQRadioButton() {}

__application__::__application__() : QFrame()
{
   {
      QFile sf( "__application__/style.qss" );
      if ( !sf.open( QFile::ReadOnly ) )
      {
         qDebug() << QString( "Error: could not open style file %1" ).arg( sf.fileName() );
         exit( -1 );
      }
      setStyleSheet( sf.readAll() );
   }

   setWindowTitle( "__title__ __version__" );
   QLabel *title = new QLabel( "<h2>__title__ __version__</h2>", this );
   title->setAlignment( Qt::AlignTop | Qt::AlignHCenter);
   QGridLayout* gl_top = new QGridLayout( 0 );

   // palette_le = new QPalette( 
   //                          QColor( Qt::red ),
   //                          QColor( Qt::darkBlue ),
   //                          QColor( Qt::gray ),
   //                          QColor( Qt::darkGray ),
   //                          QColor( Qt::cyan ),
   //                          QColor( Qt::black ),
   //                          QColor( Qt::gray ),
   //                          QColor( __text_color_rgb__ ),
   //                          QColor( Qt::darkRed ) );

   // palette_cb = new QPalette(
   //                           QColor( Qt::red ),
   //                           QColor( __text_color_rgb__ ),
   //                           QColor( Qt::gray ),
   //                           QColor( Qt::darkGray ),
   //                           QColor( Qt::black ),
   //                           QColor( Qt::yellow ),
   //                           QColor( Qt::gray ),
   //                           QColor( Qt::white ),
   //                           QColor( __background_color_rgb__ )
   //                           );

   // palette_lbl_error = new QPalette(
   //                                  QColor( Qt::red ),
   //                                  QColor( __error_color_rgb__ ),
   //                                  QColor( Qt::gray ),
   //                                  QColor( Qt::darkGray ),
   //                                  QColor( Qt::cyan ),
   //                                  QColor( Qt::black ),
   //                                  QColor( Qt::gray ),
   //                                  QColor( Qt::darkBlue ),
   //                                  QColor( __background_color_rgb__ )
   //                                         );

   // palette_plot = new QPalette(
   //                             QColor( __text_color_rgb__ ),
   //                             QColor( Qt::yellow ),
   //                             // next 2 are the box colors
   //                             QColor( __background_color_rgb__ ),
   //                             QColor( __background_color_rgb__ ),
   //                             QColor( Qt::cyan ),
   //                             QColor( Qt::green ),
   //                             QColor( Qt::red ),
   //                             QColor( Qt::green ),
   //                             QColor( __background_color_rgb__ )
   //                             );

   // palette_pb_hover = palette_app;
   // palette_pb_hover.setColor( QPalette::Button, QColor( __button_hover_g_color_rgb__ ) );

   // palette_lbl_hover = palette_app;
   // palette_lbl_hover.setColor( QPalette::WindowText, QColor( __select_color_rgb__ ) );

   QColor bgc = QColor( __background_color_rgb__ );

   push_back_color_if_ok( bgc, Qt::magenta );
   push_back_color_if_ok( bgc, Qt::darkYellow );
   push_back_color_if_ok( bgc, Qt::darkGreen );
   push_back_color_if_ok( bgc, Qt::darkCyan );
   push_back_color_if_ok( bgc, Qt::darkBlue );
   push_back_color_if_ok( bgc, Qt::darkRed );
   push_back_color_if_ok( bgc, Qt::darkMagenta );
   push_back_color_if_ok( bgc, Qt::yellow );
   push_back_color_if_ok( bgc, Qt::green );
   push_back_color_if_ok( bgc, Qt::cyan );
   push_back_color_if_ok( bgc, Qt::blue );
   push_back_color_if_ok( bgc, Qt::red );
   push_back_color_if_ok( bgc, Qt::white );
   push_back_color_if_ok( bgc, QColor( 240, 248, 255 ) ); /* Alice Blue */
   push_back_color_if_ok( bgc, QColor( 250, 235, 215 ) ); /* Antique White */
   push_back_color_if_ok( bgc, QColor( 0, 255, 255 ) ); /* Aqua* */
   push_back_color_if_ok( bgc, QColor( 127, 255, 212 ) ); /* Aquamarine */
   push_back_color_if_ok( bgc, QColor( 240, 255, 255 ) ); /* Azure */
   push_back_color_if_ok( bgc, QColor( 245, 245, 220 ) ); /* Beige */
   push_back_color_if_ok( bgc, QColor( 255, 228, 196 ) ); /* Bisque */
   push_back_color_if_ok( bgc, QColor( 0, 0, 0 ) ); /* Black* */
   push_back_color_if_ok( bgc, QColor( 255, 235, 205 ) ); /* Blanched Almond */
   push_back_color_if_ok( bgc, QColor( 0, 0, 255 ) ); /* Blue* */
   push_back_color_if_ok( bgc, QColor( 138, 43, 226 ) ); /* Blue-Violet */
   push_back_color_if_ok( bgc, QColor( 165, 42, 42 ) ); /* Brown */
   push_back_color_if_ok( bgc, QColor( 222, 184, 135 ) ); /* Burlywood */
   push_back_color_if_ok( bgc, QColor( 95, 158, 160 ) ); /* Cadet Blue */
   push_back_color_if_ok( bgc, QColor( 127, 255, 0 ) ); /* Chartreuse */
   push_back_color_if_ok( bgc, QColor( 210, 105, 30 ) ); /* Chocolate */
   push_back_color_if_ok( bgc, QColor( 255, 127, 80 ) ); /* Coral */
   push_back_color_if_ok( bgc, QColor( 100, 149, 237 ) ); /* Cornflower Blue */
   push_back_color_if_ok( bgc, QColor( 255, 248, 220 ) ); /* Cornsilk */
   push_back_color_if_ok( bgc, QColor( 0, 255, 255 ) ); /* Cyan */
   push_back_color_if_ok( bgc, QColor( 0, 0, 139 ) ); /* Dark Blue */
   push_back_color_if_ok( bgc, QColor( 0, 139, 139 ) ); /* Dark Cyan */
   push_back_color_if_ok( bgc, QColor( 184, 134, 11 ) ); /* Dark Goldenrod */
   push_back_color_if_ok( bgc, QColor( 169, 169, 169 ) ); /* Dark Gray */
   push_back_color_if_ok( bgc, QColor( 0, 100, 0 ) ); /* Dark Green */
   push_back_color_if_ok( bgc, QColor( 189, 183, 107 ) ); /* Dark Khaki */
   push_back_color_if_ok( bgc, QColor( 139, 0, 139 ) ); /* Dark Magenta */
   push_back_color_if_ok( bgc, QColor( 85, 107, 47 ) ); /* Dark Olive Green */
   push_back_color_if_ok( bgc, QColor( 255, 140, 0 ) ); /* Dark Orange */
   push_back_color_if_ok( bgc, QColor( 153, 50, 204 ) ); /* Dark Orchid */
   push_back_color_if_ok( bgc, QColor( 139, 0, 0 ) ); /* Dark Red */
   push_back_color_if_ok( bgc, QColor( 233, 150, 122 ) ); /* Dark Salmon */
   push_back_color_if_ok( bgc, QColor( 143, 188, 143 ) ); /* Dark Sea Green */
   push_back_color_if_ok( bgc, QColor( 72, 61, 139 ) ); /* Dark Slate Blue */
   push_back_color_if_ok( bgc, QColor( 47, 79, 79 ) ); /* Dark Slate Gray */
   push_back_color_if_ok( bgc, QColor( 0, 206, 209 ) ); /* Dark Turquoise */
   push_back_color_if_ok( bgc, QColor( 148, 0, 211 ) ); /* Dark Violet */
   push_back_color_if_ok( bgc, QColor( 255, 20, 147 ) ); /* Deep Pink */
   push_back_color_if_ok( bgc, QColor( 0, 191, 255 ) ); /* Deep Sky Blue */
   push_back_color_if_ok( bgc, QColor( 105, 105, 105 ) ); /* Dim Gray */
   push_back_color_if_ok( bgc, QColor( 30, 144, 255 ) ); /* Dodger Blue */
   push_back_color_if_ok( bgc, QColor( 178, 34, 34 ) ); /* Firebrick */
   push_back_color_if_ok( bgc, QColor( 255, 250, 240 ) ); /* Floral White */
   push_back_color_if_ok( bgc, QColor( 34, 139, 34 ) ); /* Forest Green */
   push_back_color_if_ok( bgc, QColor( 255, 0, 255 ) ); /* Fuschia* */
   push_back_color_if_ok( bgc, QColor( 220, 220, 220 ) ); /* Gainsboro */
   push_back_color_if_ok( bgc, QColor( 255, 250, 250 ) ); /* Ghost White */
   push_back_color_if_ok( bgc, QColor( 255, 215, 0 ) ); /* Gold */
   push_back_color_if_ok( bgc, QColor( 218, 165, 32 ) ); /* Goldenrod */
   push_back_color_if_ok( bgc, QColor( 128, 128, 128 ) ); /* Gray* */
   push_back_color_if_ok( bgc, QColor( 0, 128, 0 ) ); /* Green* */
   push_back_color_if_ok( bgc, QColor( 173, 255, 47 ) ); /* Green-Yellow */
   push_back_color_if_ok( bgc, QColor( 240, 255, 240 ) ); /* Honeydew */
   push_back_color_if_ok( bgc, QColor( 255, 105, 180 ) ); /* Hot Pink */
   push_back_color_if_ok( bgc, QColor( 205, 92, 92 ) ); /* Indian Red */
   push_back_color_if_ok( bgc, QColor( 255, 255, 240 ) ); /* Ivory */
   push_back_color_if_ok( bgc, QColor( 240, 230, 140 ) ); /* Khaki */
   push_back_color_if_ok( bgc, QColor( 230, 230, 250 ) ); /* Lavender */
   push_back_color_if_ok( bgc, QColor( 255, 240, 245 ) ); /* Lavender Blush */
   push_back_color_if_ok( bgc, QColor( 124, 252, 0 ) ); /* Lawn Green */
   push_back_color_if_ok( bgc, QColor( 255, 250, 205 ) ); /* Lemon Chiffon */
   push_back_color_if_ok( bgc, QColor( 173, 216, 230 ) ); /* Light Blue */
   push_back_color_if_ok( bgc, QColor( 240, 128, 128 ) ); /* Light Coral */
   push_back_color_if_ok( bgc, QColor( 224, 255, 255 ) ); /* Light Cyan */
   push_back_color_if_ok( bgc, QColor( 238, 221, 130 ) ); /* Light Goldenrod */
   push_back_color_if_ok( bgc, QColor( 250, 250, 210 ) ); /* Light Goldenrod Yellow */
   push_back_color_if_ok( bgc, QColor( 211, 211, 211 ) ); /* Light Gray */
   push_back_color_if_ok( bgc, QColor( 144, 238, 144 ) ); /* Light Green */
   push_back_color_if_ok( bgc, QColor( 255, 182, 193 ) ); /* Light Pink */
   push_back_color_if_ok( bgc, QColor( 255, 160, 122 ) ); /* Light Salmon */
   push_back_color_if_ok( bgc, QColor( 32, 178, 170 ) ); /* Light Sea Green */
   push_back_color_if_ok( bgc, QColor( 135, 206, 250 ) ); /* Light Sky Blue */
   push_back_color_if_ok( bgc, QColor( 132, 112, 255 ) ); /* Light Slate Blue */
   push_back_color_if_ok( bgc, QColor( 119, 136, 153 ) ); /* Light Slate Gray */
   push_back_color_if_ok( bgc, QColor( 176, 196, 222 ) ); /* Light Steel Blue */
   push_back_color_if_ok( bgc, QColor( 255, 255, 224 ) ); /* Light Yellow */
   push_back_color_if_ok( bgc, QColor( 0, 255, 0 ) ); /* Lime* */
   push_back_color_if_ok( bgc, QColor( 50, 205, 50 ) ); /* Lime Green */
   push_back_color_if_ok( bgc, QColor( 250, 240, 230 ) ); /* Linen */
   push_back_color_if_ok( bgc, QColor( 255, 0, 255 ) ); /* Magenta */
   push_back_color_if_ok( bgc, QColor( 128, 0, 0 ) ); /* Maroon* */
   push_back_color_if_ok( bgc, QColor( 102, 205, 170 ) ); /* Medium Aquamarine */
   push_back_color_if_ok( bgc, QColor( 0, 0, 205 ) ); /* Medium Blue */
   push_back_color_if_ok( bgc, QColor( 186, 85, 211 ) ); /* Medium Orchid */
   push_back_color_if_ok( bgc, QColor( 147, 112, 219 ) ); /* Medium Purple */
   push_back_color_if_ok( bgc, QColor( 60, 179, 113 ) ); /* Medium Sea Green */
   push_back_color_if_ok( bgc, QColor( 123, 104, 238 ) ); /* Medium Slate Blue */
   push_back_color_if_ok( bgc, QColor( 0, 250, 154 ) ); /* Medium Spring Green */
   push_back_color_if_ok( bgc, QColor( 72, 209, 204 ) ); /* Medium Turquoise */
   push_back_color_if_ok( bgc, QColor( 199, 21, 133 ) ); /* Medium Violet-Red */
   push_back_color_if_ok( bgc, QColor( 25, 25, 112 ) ); /* Midnight Blue */
   push_back_color_if_ok( bgc, QColor( 245, 255, 250 ) ); /* Mint Cream */
   push_back_color_if_ok( bgc, QColor( 255, 228, 225 ) ); /* Misty Rose */
   push_back_color_if_ok( bgc, QColor( 255, 228, 181 ) ); /* Moccasin */
   push_back_color_if_ok( bgc, QColor( 255, 222, 173 ) ); /* Navajo White */
   push_back_color_if_ok( bgc, QColor( 0, 0, 128 ) ); /* Navy* */
   push_back_color_if_ok( bgc, QColor( 253, 245, 230 ) ); /* Old Lace */
   push_back_color_if_ok( bgc, QColor( 128, 128, 0 ) ); /* Olive* */
   push_back_color_if_ok( bgc, QColor( 107, 142, 35 ) ); /* Olive Drab */
   push_back_color_if_ok( bgc, QColor( 255, 165, 0 ) ); /* Orange */
   push_back_color_if_ok( bgc, QColor( 255, 69, 0 ) ); /* Orange-Red */
   push_back_color_if_ok( bgc, QColor( 218, 112, 214 ) ); /* Orchid */
   push_back_color_if_ok( bgc, QColor( 238, 232, 170 ) ); /* Pale Goldenrod */
   push_back_color_if_ok( bgc, QColor( 152, 251, 152 ) ); /* Pale Green */
   push_back_color_if_ok( bgc, QColor( 175, 238, 238 ) ); /* Pale Turquoise */
   push_back_color_if_ok( bgc, QColor( 219, 112, 147 ) ); /* Pale Violet-Red */
   push_back_color_if_ok( bgc, QColor( 255, 239, 213 ) ); /* Papaya Whip */
   push_back_color_if_ok( bgc, QColor( 255, 218, 185 ) ); /* Peach Puff */
   push_back_color_if_ok( bgc, QColor( 205, 133, 63 ) ); /* Peru */
   push_back_color_if_ok( bgc, QColor( 255, 192, 203 ) ); /* Pink */
   push_back_color_if_ok( bgc, QColor( 221, 160, 221 ) ); /* Plum */
   push_back_color_if_ok( bgc, QColor( 176, 224, 230 ) ); /* Powder Blue */
   push_back_color_if_ok( bgc, QColor( 128, 0, 128 ) ); /* Purple* */
   push_back_color_if_ok( bgc, QColor( 255, 0, 0 ) ); /* Red* */
   push_back_color_if_ok( bgc, QColor( 188, 143, 143 ) ); /* Rosy Brown */
   push_back_color_if_ok( bgc, QColor( 65, 105, 225 ) ); /* Royal Blue */
   push_back_color_if_ok( bgc, QColor( 139, 69, 19 ) ); /* Saddle Brown */
   push_back_color_if_ok( bgc, QColor( 250, 128, 114 ) ); /* Salmon */
   push_back_color_if_ok( bgc, QColor( 244, 164, 96 ) ); /* Sandy Brown */
   push_back_color_if_ok( bgc, QColor( 46, 139, 87 ) ); /* Sea Green */
   push_back_color_if_ok( bgc, QColor( 255, 245, 238 ) ); /* Seashell */
   push_back_color_if_ok( bgc, QColor( 160, 82, 45 ) ); /* Sienna */
   push_back_color_if_ok( bgc, QColor( 192, 192, 192 ) ); /* Silver* */
   push_back_color_if_ok( bgc, QColor( 135, 206, 235 ) ); /* Sky Blue */
   push_back_color_if_ok( bgc, QColor( 106, 90, 205 ) ); /* Slate Blue */
   push_back_color_if_ok( bgc, QColor( 112, 128, 144 ) ); /* Slate Gray */
   push_back_color_if_ok( bgc, QColor( 255, 250, 250 ) ); /* Snow */
   push_back_color_if_ok( bgc, QColor( 0, 255, 127 ) ); /* Spring Green */
   push_back_color_if_ok( bgc, QColor( 70, 130, 180 ) ); /* Steel Blue */
   push_back_color_if_ok( bgc, QColor( 210, 180, 140 ) ); /* Tan */
   push_back_color_if_ok( bgc, QColor( 0, 128, 128 ) ); /* Teal* */
   push_back_color_if_ok( bgc, QColor( 216, 191, 216 ) ); /* Thistle */
   push_back_color_if_ok( bgc, QColor( 255, 99, 71 ) ); /* Tomato */
   push_back_color_if_ok( bgc, QColor( 64, 224, 208 ) ); /* Turquoise */
   push_back_color_if_ok( bgc, QColor( 238, 130, 238 ) ); /* Violet */
   push_back_color_if_ok( bgc, QColor( 208, 32, 144 ) ); /* Violet-Red */
   push_back_color_if_ok( bgc, QColor( 245, 222, 179 ) ); /* Wheat */
   push_back_color_if_ok( bgc, QColor( 255, 255, 255 ) ); /* White* */
   push_back_color_if_ok( bgc, QColor( 245, 245, 245 ) ); /* White Smoke */
   push_back_color_if_ok( bgc, QColor( 255, 255, 0 ) ); /* Yellow* */
   push_back_color_if_ok( bgc, QColor( 154, 205, 50 ) ); /* Yellow-Green */


   mQLabel * menu_icon = new mQLabel( "", this );
   {
      QPixmap * qpm = new QPixmap( 35, 30 );
      QPainter *pd  = new QPainter( qpm );
      pd->fillRect( 0, 0, 35, 30, QColor( __background_color_rgb__ ) );
      pd->setPen( QPen( QColor( __text_color_rgb__ ), 2 ) );
      pd->drawLine( 8, 10, 29, 10  );
      pd->drawLine( 8, 16, 29, 16 );
      pd->drawLine( 8, 22, 29, 22 );
      menu_icon->setPixmap( *qpm );
      menu_icon->pixmap_base = qpm;
   }
   {
      QPixmap * qpm = new QPixmap( 35, 30 );
      QPainter *pd  = new QPainter( qpm );
      pd->fillRect( 0, 0, 35, 30, QColor( __background_color_rgb__ ) );
      pd->setPen( QPen( QColor( __select_color_rgb__ ), 2 ) );
      pd->drawLine( 8, 10, 29, 10  );
      pd->drawLine( 8, 16, 29, 16 );
      pd->drawLine( 8, 22, 29, 22 );
      menu_icon->pixmap_hover = qpm;
   }

   connect( menu_icon, SIGNAL( pressed() ), SLOT( menu_pressed() ) );

   menu_button = new mQLabel( "", this );
   menu_button->setAlignment( Qt::AlignTop | Qt::AlignLeft );
   menu_button->mbuddy = menu_icon;
   connect( menu_button, SIGNAL( pressed() ), SLOT( menu_pressed() ) );

   gl_top->addWidget( menu_icon  , 0, 0 );
   gl_top->addWidget( menu_button, 0, 1 );
   gl_top->addWidget( title      , 0, 2 );
   gl_top->setColumnStretch( 0, 0 );
   gl_top->setColumnStretch( 1, 0 );
   gl_top->setColumnStretch( 2, 1 );

   QGridLayout * gl_menu = new QGridLayout( 0 );
   int gl_menu_pos = 0;
