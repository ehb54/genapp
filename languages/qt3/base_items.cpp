   {
      id_to_label[ "__menu:id__" ] = "__menu:label__";
      id_to_icon [ "__menu:id__" ] = QPixmap( QImage( QString( "__menu:icon__" ) ).smoothScale( 40, 60, QImage::ScaleMin ) );
      mQLabel* lbl = new mQLabel( "", this );
      lbl->setPixmap( id_to_icon[ "__menu:id__" ] );
      connect( lbl, SIGNAL( pressed() ), SLOT( __menu:id___pressed() ) );

      mQLabel* lbl2 = new mQLabel( "<h4>__menu:label__</h4>", this  );
      lbl2->setAlignment( Qt::AlignVCenter | Qt::AlignHCenter );
      connect( lbl2, SIGNAL( pressed() ), SLOT( __menu:id___pressed() ) );

      lbl->mbuddy = lbl2;

      gl_menu->addWidget( lbl2, gl_menu_pos, 0 );
      gl_menu->addWidget( lbl , gl_menu_pos, 1 );
      gl_menu->setRowStretch( gl_menu_pos, 0 );
      gl_menu_pos++;
      menu_widgets.push_back( lbl );
      menu_widgets.push_back( lbl2 );
   }
