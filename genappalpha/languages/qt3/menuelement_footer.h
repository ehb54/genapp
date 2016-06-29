   {
      QLabel * lbl = new QLabel( "", this );
      gl_panel1->addWidget( lbl, 3, 0 );
      panel1_widgets.push_back( lbl );
   }

   gl_panel1->addLayout( hbl, 0, 1 );
   panel1_layouts.push_back( hbl );
   gl_panel1->setColStretch( 0, 1 );
   gl_panel1->setColStretch( 1, 0 );
   gl_panel1->setColStretch( 2, 1 );
   gl_panel1->setRowStretch( 0, 0 );
   gl_panel1->setRowStretch( 1, 0 );
   gl_panel1->setRowStretch( 2, 0 );
   gl_panel1->setRowStretch( 3, 1 );
}
