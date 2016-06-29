   {
      mQPushButton * pb = new mQPushButton( this );
      pb->setText( "__menu:modules:label__" );
      pb->setMaximumHeight( 22 );
      pb->show();
      // this is supposed to automatically disconnect on deletion of the widget
      connect( pb, SIGNAL( clicked() ), SLOT( module_load___menu:id_____menu:modules:id__() ) );
      if ( panel1_widgets.size() )
      {
         hbl->addSpacing( 2 );
      }
      hbl->addWidget( pb );
      panel1_widgets.push_back( pb );
   }
