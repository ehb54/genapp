
   {
      QLabel * lbl = new QLabel( "", this );
      gl_menu->addWidget( lbl, gl_menu_pos, 0, 1, 2 );
      gl_menu->setRowStretch( gl_menu_pos, 1 );
   }

   gl_panel1 = new QGridLayout( 0 ); //, 1, 1, 5, 0 );
   gl_footer = new QGridLayout( 0 );
   {
      QLabel *lbl = new QLabel( "", this );
      gl_footer->addWidget( lbl, 0, 0 );
   }

   QGridLayout * gl_mid = new QGridLayout( 0 );
   gl_mid->addLayout( gl_menu, 0, 0 );
   gl_mid->addLayout( gl_panel1, 0, 1 );
   gl_mid->setColumnStretch( 0, 0 );
   gl_mid->setColumnStretch( 1, 1 );

   QGridLayout * gl_main = new QGridLayout( this ); //, 1, 1, 5, 0 );
   gl_main->addLayout( gl_top, 0, 0 );
   {
      QLabel * lbl = new QLabel( "", this );
      lbl->setMaximumHeight( 7 );
      gl_main->addWidget( lbl , 1, 0 );
   }
   gl_main->addLayout( gl_mid, 2, 0 );
   gl_main->addLayout( gl_footer, 3, 0 );
   gl_main->setRowStretch( 0, 0 );
   gl_main->setRowStretch( 1, 0 );
   gl_main->setRowStretch( 2, 0 );
   gl_main->setRowStretch( 3, 1 );
}

void __application__::menu_pressed()
{
   hide_widgets( menu_widgets, menu_widgets[ 0 ]->isVisible() );
}

void __application__::hide_widgets( QVector < QWidget * > &widgets, bool hide )
{
   for ( unsigned int i = 0; i < ( unsigned int ) widgets.size(); i++ )
   {
      hide ? widgets[ i ]->hide() : widgets[ i ]->show();
   }
}

void __application__::delete_widgets_layouts( QVector < QWidget * > &widgets, 
                                              QVector < QLayout * > &layouts
                                              )
{
   for ( unsigned int i = 0; i < ( unsigned int ) widgets.size(); i++ )
   {
      // do we need this?
      // gl_panel1->remove( widgets[ i ] );
      delete widgets[ i ];
   }
   widgets.clear();
   for ( unsigned int i = 0; i < ( unsigned int ) layouts.size(); i++ )
   {
      gl_panel1->removeItem( layouts[ i ] );
      delete layouts[ i ];
   }
   layouts.clear();
}

void __application__::save_value( const QString & id, const QString & ext )
{
   if ( global_data_types.count( id ) )
   {
      QString did = id + ":" + ext;
      if ( global_data_types[ id ] == "le" )
      {
         global_data[ did ] = QVariant( ((QLineEdit *)panel1_widget_map[ id ])->text() );
         return;
      }
      if ( global_data_types[ id ] == "cb" )
      {
         global_data[ did ] = QVariant( ((QCheckBox *)panel1_widget_map[ id ])->isChecked() );
         return;
      }
      if ( global_data_types[ id ] == "rb" )
      {
         global_data[ did ] = QVariant( ((QRadioButton *)panel1_widget_map[ id ])->isChecked() );
         return;
      }
      if ( global_data_types[ id ] == "lw" )
      {
         global_data[ did ] = QVariant( ((QListWidget *)panel1_widget_map[ id ])->currentRow() );
         return;
      }
      if ( global_data_types[ id ] == "lbl" )
      {
         global_data[ did ] = QVariant( ((QLabel *)panel1_widget_map[ id ])->text() );
         return;
      }
      if ( global_data_types[ id ] == "te" )
      {
         global_data[ did ] = QVariant( ((QTextEdit *)panel1_widget_map[ id ])->toPlainText() );
         return;
      }
      if ( global_data_types[ id ] == "file" )
      {
         global_data[ did ] = ((mQPushButton *)panel1_widget_map[ id ])->data;
         return;
      }
      if ( global_data_types[ id ] == "files" )
      {
         global_data[ did ] = ((mQPushButton *)panel1_widget_map[ id ])->data;
         return;
      }
      if ( global_data_types[ id ] == "outfile" )
      {
         // global_data[ did ] = QVariant( ((QLineEdit *)panel1_widget_map[ id ])->text() );
         global_data[ did ] = QVariant( ((mQLabel *)panel1_widget_map[ id ])->text() );
         return;
      }
      if ( global_data_types[ id ] == "outfiles" )
      {
         // global_data[ did ] = QVariant( ((QLineEdit *)panel1_widget_map[ id ])->text() );
         global_data[ did ] = QVariant( ((mQLabel *)panel1_widget_map[ id ])->text() );
         return;
      }
      qDebug() <<
         QString( "Error: __application__::save_value( %1 ): unsupporded data type '%2'\n" )
         .arg( id )
         .arg( global_data_types[ id ] )
         ;
      return;
   }
   qDebug() <<
      QString( "Error: __application__::save_value( %1, %2 ): no global_data_type[] found\n" )
      .arg( id )
      .arg( ext )
      ;
}

void __application__::save_last_value( const QString & id )
{
   save_value( id, "last_value" );
}

void __application__::save_default_value( const QString & id )
{
   if ( !global_data.count( id ) )
   {
      save_value( id, "default_value" );
   }
}

void __application__::save_last_values()
{
   for ( int i = 0; i < (int) panel1_inputs.size(); ++i )
   {
      save_last_value( panel1_inputs[ i ] );
   }
}

void __application__::reset_value( const QString & id, const QString & ext )
{
   if ( global_data_types.count( id ) )
   {
      QString did = id + ":" + ext;
      if ( ext == "last_value" && !global_data.count( did ) )
      {
         QString did2 = id + ":default_value";
         if ( global_data.count( did2 ) )
         {
            global_data[ did ] = global_data[ did2 ];
         }
      }

      if ( global_data.count( did ) )
      {
         if ( global_data_types[ id ] == "le" )
         {
            ((QLineEdit *)panel1_widget_map[ id ])->setText( global_data[ did ].toString() );
            save_last_value( id );
            return;
         } 
         if ( global_data_types[ id ] == "cb" )
         {
            ((QCheckBox *)panel1_widget_map[ id ])->setChecked( global_data[ did ].toBool() );
            save_last_value( id );
            return;
         } 
         if ( global_data_types[ id ] == "rb" )
         {
            ((QRadioButton *)panel1_widget_map[ id ])->setChecked( global_data[ did ].toBool() );
            save_last_value( id );
            return;
         } 
         if ( global_data_types[ id ] == "lw" )
         {
            ((QListWidget *)panel1_widget_map[ id ])->setCurrentRow( global_data[ did ].toInt() );
            save_last_value( id );
            return;
         } 
         if ( global_data_types[ id ] == "lbl" )
         {
            ((QLabel *)panel1_widget_map[ id ])->setText( global_data[ did ].toString() );
            save_last_value( id );
            return;
         } 
         if ( global_data_types[ id ] == "te" )
         {
            ((QTextEdit *)panel1_widget_map[ id ])->setText( global_data[ did ].toString() );
            save_last_value( id );
            return;
         } 
         if ( global_data_types[ id ] == "plt" )
         {
            QwtPlot * plt = (QwtPlot *)panel1_widget_map[ id ];
            plt->clear();
            // add the curves processed from global_data[ did ].toString()
            QVector < plotData > * plot_results = 
               UTILITY_JSON::array_string_to_qvv( global_data[ did ].toString() );
            for ( int i = 0; i < (int) plot_results->size(); ++i )
            {
               QString label = QString( "%1" ).arg( i ); // todo: generate labels
               QwtPlotCurve * curve = new QwtPlotCurve( label );
               curve->setStyle( QwtPlotCurve::Lines );
               
               curve->setData( 
                              (double *)&( (*plot_results)[ i ].x[ 0 ] ),
                              (double *)&( (*plot_results)[ i ].y[ 0 ] ),
                              (*plot_results)[ i ].x.size()
                               );
               curve->setPen( QPen( plot_colors[ i ], 1, Qt::SolidLine ) );
               curve->attach( plt );
            }
            // marker example
            // {
            //    QwtPlotMarker* marker = new QwtPlotMarker;
            //    marker->setLineStyle(QwtPlotMarker::VLine);
            //    marker->setLabel( QString::fromLatin1("marker") );
            //    marker->setLabelOrientation(Qt::Horizontal);
            //    marker->setLinePen(QPen(Qt::green, 0, Qt::DashDotLine));
            //    marker->setLabelAlignment(Qt::AlignLeft | Qt::AlignBottom);
            //    marker->setXValue( 12.5 );
            //    marker->attach( plt );
            // }
            plt->replot();
            delete plot_results;
            if ( ext == "default_value" )
            {
               global_data[ id + ":last_value" ] = global_data[ did ];
            }
            return;
         } 
         if ( global_data_types[ id ] == "file" )
         {
            ((mQPushButton *)panel1_widget_map[ id ])->data = global_data[ did ];
            ((mQPushButton *)panel1_widget_map[ id ])->mbuddy->setText( global_data[ did ].toStringList().size() ?
                                                                        QFileInfo( global_data[ did ].toStringList()[ 0 ] ).fileName() :
                                                                        QString( "No file selected." ) );
            if ( ext == "default_value" )
            {
               save_last_value( id );
            }
            return;
         } 
         if ( global_data_types[ id ] == "files" )
         {
            ((mQPushButton *)panel1_widget_map[ id ])->data = global_data[ did ];
            int count = global_data[ did ].toStringList().size();
            ((mQPushButton *)panel1_widget_map[ id ])->mbuddy->setText( count ?
                                                                        ( count == 1 ?
                                                                          QFileInfo( global_data[ did ].toStringList()[ 0 ] ).fileName() :
                                                                          QString( "%1 files selected" ).arg( count ) ) : QString( "No files selected." ) );
            if ( ext == "default_value" )
            {
               save_last_value( id );
            }
            return;
         } 
         if ( global_data_types[ id ] == "outfile" )
         {
            // ((QLineEdit *)panel1_widget_map[ id ])->setText( global_data[ did ].toString() );
            ((mQLabel *)panel1_widget_map[ id ])->setText( global_data[ did ].toString() );
            save_last_value( id );
            return;
         }
         if ( global_data_types[ id ] == "outfiles" )
         {
            // ((QLineEdit *)panel1_widget_map[ id ])->setText( global_data[ did ].toString() );
            ((mQLabel *)panel1_widget_map[ id ])->setText( global_data[ did ].toString() );
            save_last_value( id );
            return;
         }
         qDebug() <<
                QString( "Error: __application__::reset_value( %1, %2 ): unsupporded data type '%3'\n" )
                .arg( id )
                .arg( ext )
                .arg( global_data_types[ id ] )
            ;
      } else {
         qDebug() << QString( "Error: __application__::reset value( %1, %2 ) no global data found\n" ).arg( id ).arg( ext );
      }
      return;
   }
   qDebug() <<
      QString( "Error: __application__::reset_value( %1, %2 ): no global_data_type[] found\n" )
      .arg( id )
      .arg( ext )
      ;
}

void __application__::reset_output_values( const QString & ext )
{
   for ( int i = 0; i < (int) panel1_outputs.size(); ++i )
   {
      reset_value( panel1_outputs[ i ], ext );
   }
}

void __application__::reset_values( const QString & ext )
{
   for ( int i = 0; i < (int) panel1_inputs.size(); ++i )
   {
      reset_value( panel1_inputs[ i ], ext );
   }
   reset_output_values( ext );
}

void __application__::reset_default_values()
{
   reset_values( "default_value" );
}

void __application__::reset_last_values()
{
   reset_values( "last_value" );
}

QString __application__::get_last_value( const QString & id, bool & skip )
{
   skip = false;
   if ( global_data_types.count( id ) )
   {
      QString did = id + ":last_value";
      if ( global_data_types[ id ] == "le" || 
           global_data_types[ id ] == "lbl" ||
           global_data_types[ id ] == "te" )
      {
         return global_data[ did ].toString();
      }
      if ( global_data_types[ id ] == "cb" )
      {
         skip = !global_data[ did ].toBool();
         return skip ? "off" : "on";
      }
      if ( global_data_types[ id ] == "rb" )
      {
         skip = !global_data[ did ].toBool();
         return skip ? QString( "" ) : ((mQRadioButton *)panel1_widget_map[ id ])->data.toString();
      }

      if ( global_data_types[ id ] == "lw" )
      {
         return panel1_map_input[ "lw:" + ((QListWidget *)panel1_widget_map[ id ])->item( global_data[ did ].toInt() )->text() ];
      }
      if ( global_data_types[ id ] == "file" ||
           global_data_types[ id ] == "files" )
      {
         return global_data[ did ].toStringList().size() ?
            "[\"" + global_data[ did ].toStringList().join( "\",\"" ) + "\"]" :
            "[ ]";
      }
      qDebug() <<
         QString( "Error: __application__::get_last_value( %1 ): unsupporded data type '%2'\n" )
         .arg( id )
         .arg( global_data_types[ id ] )
         ;
      return "**error**";
   }
   qDebug() <<
      QString( "Error: __application__::get_last_value( %1 ): no global_data_type[] found\n" )
      .arg( id )
      ;
   return "**error**";
}

QString __application__::input_to_json( const QString & mod, const QString & dir )
{
   QMap < QString, QString > inputs;
   QRegExp rxclean = QRegExp( "^" + mod + ":" );
   bool skip;
   for ( int i = 0; i < (int) panel1_inputs.size(); ++i )
   {
      QString cleaned = panel1_inputs[ i ];
      if ( panel1_map_input.count( cleaned ) )
      {
         qDebug() << QString( "input_to_json::renaming %1 %2" ).arg( cleaned ).arg( panel1_map_input[ cleaned ] );
         cleaned = panel1_map_input[ cleaned ];
      }
      cleaned.replace( rxclean, "" );
      QString last_value = get_last_value( panel1_inputs[ i ], skip );
      if ( !skip )
      {
         inputs[ cleaned ] = last_value;
      }
   }
   inputs[ "_base_directory" ] = dir;
   return UTILITY_JSON::compose( inputs );
}

void __application__::process_results( const QString & mod )
{
   //   qDebug() << process_json[ mod ];
   QMap < QString, QString > results = UTILITY_JSON::split( process_json[ mod ] );
   // now store in global data and display if active   

   QString errors;
   for ( QMap < QString, QString >::iterator it = results.begin();
         it != results.end();
         it++ )
   {
      qDebug() << QString( "%1 => %2" ).arg( it.key() ).arg( it.value().left( 100 ) );
      QString key = mod + ":" + it.key();
      if ( !global_data.count( key + ":default_value" ) )
      {
         if ( it.key().left( 1 ) != "_" )
         {
            qDebug() << "unknown key received: " + key;
            if ( !errors.length() )
            {
               errors = "Unexpected results:\n";
            }
            errors += QString( "  %1 => %2\n" ).arg( it.key() ).arg( it.value().left( 100 ) );
         }
      } else {
         if ( global_data_types.count( key ) )
         {
            bool ok = false;
            if (
                global_data_types[ key ] == "le" ||
                global_data_types[ key ] == "lbl" ||
                global_data_types[ key ] == "plt" ||
                global_data_types[ key ] == "outfile" ||
                global_data_types[ key ] == "outfiles"
                )
            {
               global_data[ key + ":last_value" ] = QVariant( it.value() );
               ok = true;
            }
            if ( global_data_types[ key ] == "te" )
            {
               global_data[ key + ":last_value" ] = QVariant( QString( it.value() ).replace( "\\n", "\n" ) );
               ok = true;
            }
            if ( global_data_types[ key ] == "cb" ||
                 global_data_types[ key ] == "rb" )
            {
               global_data[ key + ":last_value" ] = QVariant( true );
               ok = true;
            }
            if ( !ok )
            {
               qDebug() << "__application__::process_results() unsupported output data type: " + global_data_types[ key ] + " key: " + key;
            }          
            //         global_data[ key + ":last_value" ] = QVariant( it.value() );
            if ( current_module_id == mod &&
                 global_data_types.count( key ) )
            {
               reset_value( key, "last_value" );
            } else {
               qDebug() << "current module wrong or no global data types for key: " + key;
            }
         } else {
            qDebug() << "__application__::process_results() global_data_types[] does not contain: " + key;
         }            
      }
   }

   {
      QString key = mod + ":_errorMessages";    
      global_data[ key + ":last_value" ] = QVariant( errors );
      if ( current_module_id == mod &&
           global_data_types.count( key ) )
      {
         reset_value( key, "last_value" );
      } else {
         qDebug() << "current module wrong or no global data types for key: " + key;
      }
   }
}

void __application__::push_back_color_if_ok( QColor bg, QColor set )
{
   double sum = 
      fabs( (float) bg.red  () - (float) set.red  () ) +
      fabs( (float) bg.green() - (float) set.green() ) +
      fabs( (float) bg.blue () - (float) set.blue () );
   if ( sum > 150 )
   {
      if ( plot_colors.size() )
      {
         bg = plot_colors.back();
         double sum = 
            fabs( (float) bg.red  () - (float) set.red  () ) +
            fabs( (float) bg.green() - (float) set.green() ) +
            fabs( (float) bg.blue () - (float) set.blue () );
         if ( sum > 100 )
         {
            plot_colors.push_back( set );
         }
      } else {
         plot_colors.push_back( set );
      }
   }
}

void __application__::browse_filenames( const QString & label,
                                        const QString & id,
                                        bool  multiple_files )
{
   QStringList filenames;
   QString tag = "Select for " + label;

   if ( panel1_is_input.count( id ) )
   {

      mQPushButton * pb = (mQPushButton *)panel1_widget_map[ id ];

      if ( multiple_files )
      {
         filenames = QFileDialog::getOpenFileNames( 
                                                    this,
                                                    tag
                                                    );

         // QString::null,
         //  QString::null,
         //  this,
         //  tag,
         //  tag
         // );
      } else {
         QString filename = QFileDialog::getOpenFileName( 
                                                         this,
                                                         tag 
                                                          );
         // QString::null,
         //  QString::null,
         //  this,
         //  tag,
         //  tag
         // );
         if ( !filename.isEmpty() )
         {
            filenames << filename;
         }
      }
      pb->data = QVariant( filenames );
      save_value( id, "tmp_value" );
      reset_value( id, "tmp_value" );
      return;
   }

   QFile f( ((mQLabel *)panel1_widget_map[ id ])->text() );
   if ( !f.exists() )
   {
      QMessageBox::warning( this,
                            windowTitle(),
                            QString( tr( "The file %1 does not exist" ) ).arg( f.fileName() ) );
      return;
   }
   QFileInfo fi( f.fileName() );
   QString ext = fi.suffix().toLower();

   if ( ext == "pdb" )
   {
      spawn_app( "__helper:pdb__", f.fileName() );
      return;
   }
   spawn_app( "__helper:txt__", f.fileName() );
}

void __application__::spawn_app( const QString & appname, const QString & filename )
{
   QStringList args;
   args << filename;

   if ( !QProcess::startDetached( appname, args ) )
   {
      QMessageBox::warning( this,
                            windowTitle(),
                            QString( tr( "Error trying to start command %1.  Make sure it is in your default PATH" ) ).arg( appname ) );
   }      
}

int main( int argc, char *argv[] )
{
   QApplication *app = new QApplication( argc, argv );
   //   app->setPalette( QPalette( QColor( __button_g_color_rgb__ ), QColor( __background_color_rgb__ ) ) );
   //   palette_app = app->palette();
   //   palette_app.setColor( QPalette::ButtonText, QColor( 0, 0, 0 ) );
   //   app->setPalette( palette_app );
   __application__ * __application___main = new __application__();
   __application___main->show();
   return app->exec();
}
